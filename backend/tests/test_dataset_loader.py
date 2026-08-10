"""
Tests for dataset loading.

The API test suite patches `app.get_datasets`, so nothing there exercises
`DatasetLoader.load_all_datasets` itself. That gap let a bug live in
production unnoticed: the "critical datasets present?" guard was written as
`not datasets.get("food")`, and a DataFrame has no truth value, so it raised
ValueError("The truth value of a DataFrame is ambiguous") on every *successful*
load. Startup logged "Dataset loading failed ... Continuing with limited
functionality" on each boot, and every dataset-backed endpoint went down with
it. These tests cover the guard directly.
"""
import os
import sys

import pandas as pd
import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from dataset_loader import DatasetLoader
from exceptions import DatasetError


@pytest.fixture
def loader():
    return DatasetLoader()


def _stub(loader, **frames):
    """Point each dataset loader at a caller-supplied frame."""
    for name, frame in frames.items():
        setattr(loader, f"load_{name}_dataset", lambda frame=frame: frame)


class TestLoadAllDatasets:
    """The critical-dataset guard in load_all_datasets()."""

    def test_returns_all_frames_when_every_dataset_loads(self, loader):
        frames = {
            name: pd.DataFrame({"col": [1, 2, 3]})
            for name in ("food", "dosha", "patient", "lifestyle")
        }
        _stub(loader, **frames)

        datasets = loader.load_all_datasets()

        assert set(datasets) == {"food", "dosha", "patient", "lifestyle"}
        assert all(len(df) == 3 for df in datasets.values())

    def test_non_empty_frames_do_not_raise(self, loader):
        """Regression: the guard used to raise on a perfectly good load."""
        _stub(
            loader,
            food=pd.DataFrame({"name": ["rice"]}),
            dosha=pd.DataFrame({"dosha": ["vata"]}),
            patient=pd.DataFrame({"id": [1]}),
            lifestyle=pd.DataFrame({"id": [1]}),
        )

        # Must not raise ValueError from a DataFrame truth test.
        assert loader.load_all_datasets()["food"].iloc[0]["name"] == "rice"

    def test_real_csvs_load_without_error(self, loader):
        """End to end against the committed CSVs, as run.py does at startup."""
        if not os.path.exists(settings.FOOD_DATASET_PATH):
            pytest.skip("food dataset CSV not present")

        datasets = loader.load_all_datasets()

        assert not datasets["food"].empty
        assert not datasets["dosha"].empty

    @pytest.mark.parametrize("missing", ["food", "dosha"])
    def test_empty_critical_dataset_raises(self, loader, missing):
        frames = {
            name: pd.DataFrame({"col": [1]})
            for name in ("food", "dosha", "patient", "lifestyle")
        }
        frames[missing] = pd.DataFrame()
        _stub(loader, **frames)

        with pytest.raises(DatasetError) as excinfo:
            loader.load_all_datasets()

        assert excinfo.value.error_code == "CRITICAL_DATASETS_MISSING"
        assert missing in excinfo.value.message

    def test_failed_critical_loader_raises(self, loader):
        """A loader that raises DatasetError leaves its key absent entirely."""
        def boom():
            raise DatasetError("file not found", "LOAD_FAILED")

        _stub(
            loader,
            dosha=pd.DataFrame({"col": [1]}),
            patient=pd.DataFrame({"col": [1]}),
            lifestyle=pd.DataFrame({"col": [1]}),
        )
        loader.load_food_dataset = boom

        with pytest.raises(DatasetError) as excinfo:
            loader.load_all_datasets()

        assert "food" in excinfo.value.message

    def test_optional_dataset_failure_is_tolerated(self, loader):
        """Only food and dosha are critical; the rest degrade quietly."""
        def boom():
            raise DatasetError("file not found", "LOAD_FAILED")

        _stub(
            loader,
            food=pd.DataFrame({"col": [1]}),
            dosha=pd.DataFrame({"col": [1]}),
            patient=pd.DataFrame({"col": [1]}),
        )
        loader.load_lifestyle_dataset = boom

        datasets = loader.load_all_datasets()

        assert "lifestyle" not in datasets
        assert set(datasets) == {"food", "dosha", "patient"}
