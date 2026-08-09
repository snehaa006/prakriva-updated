-- Demonstration doctor accounts.
--
-- These are FICTIONAL composite practitioners. The institutions, councils and
-- registration formats are real so the directory looks and validates like the
-- real thing, but no real practitioner's identity or registration number is
-- used. Every row is flagged `is_demo = true` so it can be filtered or purged
-- before launch:
--
--   delete from auth.users where id in (select id from public.doctors where is_demo);
--
-- Login for all three is the shared demo password set when the accounts were
-- seeded. They are demo credentials on a prototype — do not reuse that password
-- for anything real, and purge these accounts before the app handles real
-- patients.
--
-- A correctness note on the data this replaces: the previous seed paired BAMS
-- degrees with the Medical Council of India / NMC. Those bodies register
-- allopathic (MBBS) practitioners. Ayurvedic practitioners register under the
-- Ministry of AYUSH / NCISM and their state Board of Indian Medicine, which is
-- what these rows now use, with the AYU/<state>/<6 digits> registration format
-- the signup form already validates.
--
-- Run after doctor_verification.sql — verification is applied through
-- public.verify_doctor(), the same service-role path a real approval uses,
-- rather than by writing the trust columns directly.

begin;

-- ---------------------------------------------------------------------------
-- 1. Retire the surplus demo accounts.
--
--    rajesh.kumar.demo is deliberately kept: it carries real consultation
--    requests and notifications from live patient accounts, and every foreign
--    key into it is ON DELETE CASCADE, so removing it would delete genuine
--    patient history.
-- ---------------------------------------------------------------------------

delete from auth.users
 where email in (
   'arjun.patel.demo@prakriva.app',
   'lakshmi.rao.demo@prakriva.app',
   'rohit.joshi.demo@prakriva.app',
   'sita.gupta.demo@prakriva.app',
   'vikram.singh.demo@prakriva.app'
 );

-- ---------------------------------------------------------------------------
-- 2. Rewrite the three survivors with credentials that hold up to inspection.
-- ---------------------------------------------------------------------------

update public.doctors set
  is_demo                  = true,
  name                     = 'Dr. Rajesh Kumar',
  phone_number             = '+91 20 2543 8890',
  license_number           = 'AYU/MH/104627',
  medical_council          = 'ayush',
  graduation_year          = 2013,
  medical_degree           = 'md',
  ayurvedic_certification  = 'MD (Ayurveda) - Kayachikitsa, Institute of Teaching and Research in Ayurveda (ITRA), Jamnagar',
  ayurvedic_specialization = array['Panchakarma', 'Kayachikitsa', 'Digestive Health'],
  traditional_training     = 'Classical Panchakarma protocols - Vamana, Virechana and Basti - under the Panchakarma department at ITRA, Jamnagar',
  clinic_name              = 'Sushruta Ayurveda & Panchakarma Kendra',
  clinic_address           = 'Plot 14, Karve Road, Kothrud, Pune, Maharashtra 411038',
  years_of_experience      = 12,
  consultation_fee         = '700',
  consultation_modes       = array['in-person', 'video'],
  languages                = array['English', 'Hindi', 'Marathi'],
  special_conditions       = array['Irritable Bowel Syndrome', 'Acid Reflux', 'Chronic Constipation', 'Non-alcoholic Fatty Liver'],
  working_hours            = 'Mon-Sat, 9:00 AM - 1:00 PM and 5:00 PM - 8:00 PM',
  education                = array[
                               'BAMS - Tilak Maharashtra Vidyapeeth, Pune (2010)',
                               'MD (Ayurveda) Kayachikitsa - ITRA, Jamnagar (2013)'
                             ],
  bio                      = 'Ayurvedic physician practising in Pune with a focus on digestive and metabolic disorders. Combines classical Panchakarma therapy with dietary and lifestyle correction, and treats gut conditions that have not settled with symptomatic management alone.',
  rating                   = 4.7,
  total_reviews            = 128,
  total_consultations      = 940,
  is_active                = true
where email = 'rajesh.kumar.demo@prakriva.app';

update public.doctors set
  is_demo                  = true,
  name                     = 'Dr. Priya Sharma',
  phone_number             = '+91 80 4123 7756',
  license_number           = 'AYU/KA/143852',
  medical_council          = 'ayush',
  graduation_year          = 2011,
  medical_degree           = 'md',
  ayurvedic_certification  = 'MD (Ayurveda) - Prasuti Tantra evam Stri Roga, National Institute of Ayurveda, Jaipur',
  ayurvedic_specialization = array['Prasuti Tantra & Stri Roga', 'Women''s Health', 'Twak Roga (Skin & Hair)'],
  traditional_training     = 'Advanced training in Garbhini Paricharya (classical antenatal care) at the National Institute of Ayurveda, Jaipur',
  clinic_name              = 'Sanjeevani Ayurveda Women''s Wellness Centre',
  clinic_address           = '2nd Block, 11th Main Road, Jayanagar, Bengaluru, Karnataka 560011',
  years_of_experience      = 15,
  consultation_fee         = '900',
  consultation_modes       = array['video', 'in-person'],
  languages                = array['English', 'Hindi', 'Kannada'],
  special_conditions       = array['PCOS', 'Menstrual Disorders', 'Menopause', 'Postnatal Recovery', 'Iron Deficiency Anaemia'],
  working_hours            = 'Mon-Fri, 10:00 AM - 5:00 PM',
  education                = array[
                               'BAMS - Government Ayurveda Medical College, Bengaluru (RGUHS, 2008)',
                               'MD (Ayurveda) Prasuti Tantra evam Stri Roga - National Institute of Ayurveda, Jaipur (2011)'
                             ],
  bio                      = 'Ayurvedic gynaecologist with fifteen years in women''s health, working mainly on PCOS, menstrual disorders and the perimenopausal transition. Practice centres on cycle-aware diet and herbal management alongside conventional monitoring, with antenatal and postnatal care drawn from classical Garbhini Paricharya.',
  rating                   = 4.9,
  total_reviews            = 214,
  total_consultations      = 1560,
  is_active                = true
where email = 'priya.sharma.demo@prakriva.app';

update public.doctors set
  is_demo                  = true,
  name                     = 'Dr. Meera Nair',
  phone_number             = '+91 484 2377 214',
  license_number           = 'AYU/KL/207431',
  medical_council          = 'ayush',
  graduation_year          = 2012,
  medical_degree           = 'md',
  ayurvedic_certification  = 'MD (Ayurveda) - Panchakarma, Institute of Teaching and Research in Ayurveda (ITRA), Jamnagar',
  ayurvedic_specialization = array['Panchakarma', 'Joint & Arthritis Care', 'Kayachikitsa'],
  traditional_training     = 'Kerala Panchakarma tradition - Pizhichil, Navarakizhi and Kativasti - at Government Ayurveda College, Thiruvananthapuram',
  clinic_name              = 'Dhanwantari Ayurveda Chikitsalayam',
  clinic_address           = 'Kaloor-Kadavanthra Road, Ernakulam, Kochi, Kerala 682017',
  years_of_experience      = 14,
  consultation_fee         = '750',
  consultation_modes       = array['in-person', 'video'],
  languages                = array['English', 'Malayalam', 'Tamil', 'Hindi'],
  special_conditions       = array['Rheumatoid Arthritis', 'Osteoarthritis', 'Sciatica', 'Cervical Spondylosis', 'Frozen Shoulder'],
  working_hours            = 'Mon-Sat, 8:00 AM - 12:00 PM and 4:00 PM - 7:00 PM',
  education                = array[
                               'BAMS - Government Ayurveda College, Thiruvananthapuram (KUHS, 2009)',
                               'MD (Ayurveda) Panchakarma - ITRA, Jamnagar (2012)'
                             ],
  bio                      = 'Panchakarma specialist trained in the Kerala tradition, treating chronic musculoskeletal and inflammatory joint conditions. Runs structured multi-week therapy courses - Pizhichil, Navarakizhi and Kativasti - supported by dietary management for patients living with long-term arthritis pain.',
  rating                   = 4.6,
  total_reviews            = 96,
  total_consultations      = 705,
  is_active                = true
where email = 'meera.nair.demo@prakriva.app';

-- ---------------------------------------------------------------------------
-- 3. Verify them through the service-role path, exactly as a real approval
--    would. verification_score, trust_score, verification_badge and badges are
--    derived server-side by the doctors_enforce_verification trigger.
-- ---------------------------------------------------------------------------

select public.verify_doctor(
  d.id,
  true,
  jsonb_build_object(
    'verifiedName',       d.name,
    'registrationDate',   reg.registration_date,
    'councilStatus',      'active',
    'verifyingCouncil',   reg.council,
    'verificationMethod', 'manual_admin_review',
    'note',               'Seeded demonstration account - fictional practitioner, not a real registration'
  )
)
from public.doctors d
join (values
  ('rajesh.kumar.demo@prakriva.app', '2013-09-12', 'Maharashtra Council of Indian Medicine'),
  ('priya.sharma.demo@prakriva.app', '2011-08-19', 'Karnataka Ayurvedic and Unani Practitioners'' Board'),
  ('meera.nair.demo@prakriva.app',   '2012-07-05', 'Kerala Ayurveda Medical Council')
) as reg(email, registration_date, council) on reg.email = d.email;

commit;
