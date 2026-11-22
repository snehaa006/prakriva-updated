-- Demonstration patients, four more demonstration doctors, and consultation
-- requests to Dr. Rajesh Kumar's demo account (rajesh.kumar.demo@prakriva.app).
--
-- Everyone here is FICTIONAL. Doctors follow demo_doctors.sql: real
-- institutions and councils so the directory reads true, fictional people and
-- registration numbers, every row flagged is_demo. Patients use addresses
-- ending .patient.demo@prakriva.app so they can be found and removed in one go
-- (see the bottom of this file).
--
-- HOW TO RUN
--   1. Supabase dashboard -> SQL Editor -> New query -> paste this file.
--   2. Set the demo password on the line marked  >>> SET THIS <<<  below.
--      Every account created here signs in with it.
--   3. Run. Safe to run again: existing accounts are reused, nothing is
--      duplicated, and requests are only added where none exists yet.
--
-- Run after doctor_verification.sql, disease_screenings.sql,
-- patient_pantry_items.sql and pcos_tracking.sql. Accounts are created the way
-- a real signup creates them: inserting into auth.users fires
-- handle_new_user(), which writes the profiles and doctors/patients rows from
-- the signup metadata; doctors are then approved through verify_doctor(), the
-- same service-role path a real approval uses.
--
-- WHAT RAJESH SEES
--   4 pending requests (Aisha, Neha, Ritu, Sana) to accept or decline on his
--   dashboard, and 2 accepted patients (Kavya, Pooja) already in his patient
--   list and in the Recipe Builder picker - both pregnant, both with a recent
--   screening and a stocked kitchen, so Generate Diet Chart has everything.

begin;

-- A sign-in account, created as Supabase Auth creates one for an email signup
-- with the address already confirmed. Returns the existing account's id when
-- the address is taken, so re-running reuses it. Session-local (pg_temp): it
-- disappears when this run ends.
create or replace function pg_temp.demo_account(p_email text, p_password text, p_meta jsonb)
returns uuid
language plpgsql
as $fn$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is not null then
    return uid;
  end if;

  uid := gen_random_uuid();
  -- The token columns must be '' rather than NULL: Auth reads them as strings
  -- and a NULL one makes sign-in fail with "Database error querying schema".
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone_change, phone_change_token,
    reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb, p_meta, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  return uid;
end;
$fn$;

do $$
declare
  demo_password constant text := 'CHOOSE-A-DEMO-PASSWORD';   -- >>> SET THIS <<<

  rajesh   public.doctors;
  uid      uuid;
  d        record;
  p        record;
  inserted int := 0;
begin
  if demo_password = 'CHOOSE-A-DEMO-PASSWORD' or length(demo_password) < 8 then
    raise exception 'Set demo_password (marked >>> SET THIS <<<) to a password of 8+ characters before running.';
  end if;

  select * into rajesh from public.doctors where email = 'rajesh.kumar.demo@prakriva.app';
  if not found then
    raise exception 'rajesh.kumar.demo@prakriva.app has no doctors row - create that account first (demo_doctors.sql).';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Four more demonstration doctors.
  -- -------------------------------------------------------------------------
  for d in
    select * from (values
      ('ananya.deshpande.demo@prakriva.app', 'Dr. Ananya Deshpande', 'AYU/MH/118204', 2014,
       'MD (Ayurveda) - Prasuti Tantra evam Stri Roga, Government Ayurved College, Nagpur',
       array['Prasuti Tantra & Stri Roga', 'Garbhini Paricharya (Antenatal Care)', 'Women''s Health'],
       'Garbhini Paricharya (antenatal) and Sutika Paricharya (postnatal) care at Government Ayurved College, Nagpur',
       'Matruvatsalya Ayurveda Clinic', '3rd Floor, Shivaji Park Road, Dadar West, Mumbai, Maharashtra 400028',
       11, '800', array['video', 'in-person'], array['English', 'Hindi', 'Marathi'],
       array['Pregnancy Nutrition', 'Gestational Diabetes', 'Anaemia in Pregnancy', 'Postnatal Recovery'],
       '+91 22 2444 6182', 'Mon-Sat, 10:00 AM - 6:00 PM',
       array['BAMS - Government Ayurved College, Nagpur (2011)',
             'MD (Ayurveda) Prasuti Tantra evam Stri Roga - Government Ayurved College, Nagpur (2014)'],
       'Ayurvedic obstetric and gynaecology physician focused on pregnancy nutrition. Plans trimester-wise diets from classical Garbhini Paricharya alongside routine antenatal monitoring, with particular attention to anaemia and gestational diabetes.',
       4.8, 167, 1120, '2014-08-21', 'Maharashtra Council of Indian Medicine'),

      ('sameer.joshi.demo@prakriva.app', 'Dr. Sameer Joshi', 'AYU/GJ/131576', 2010,
       'MD (Ayurveda) - Kayachikitsa, Gujarat Ayurved University, Jamnagar',
       array['Kayachikitsa', 'Prameha (Diabetes) Care', 'Metabolic Health'],
       'Prameha (diabetes) and Sthaulya (obesity) management protocols at Gujarat Ayurved University, Jamnagar',
       'Charaka Ayurveda Metabolic Care', 'C.G. Road, Navrangpura, Ahmedabad, Gujarat 380009',
       16, '650', array['in-person', 'video'], array['English', 'Hindi', 'Gujarati'],
       array['Type 2 Diabetes', 'Prediabetes', 'Obesity', 'Hypertension', 'Dyslipidaemia'],
       '+91 79 2646 3391', 'Mon-Sat, 9:30 AM - 1:30 PM and 5:30 PM - 8:30 PM',
       array['BAMS - Gujarat Ayurved University, Jamnagar (2007)',
             'MD (Ayurveda) Kayachikitsa - Gujarat Ayurved University, Jamnagar (2010)'],
       'Physician for metabolic disorders, combining Ayurvedic dietetics and daily-routine correction with conventional glucose and lipid monitoring. Works mostly with prediabetes, type 2 diabetes and weight that has not responded to calorie counting alone.',
       4.6, 142, 1290, '2010-09-02', 'Gujarat Board of Ayurvedic and Unani Systems of Medicine'),

      ('harpreet.kaur.demo@prakriva.app', 'Dr. Harpreet Kaur', 'AYU/PB/164029', 2015,
       'MD (Ayurveda) - Swasthavritta & Yoga, Guru Ravidas Ayurved University, Hoshiarpur',
       array['Swasthavritta (Preventive Health)', 'Ahara (Diet) Therapy', 'PCOS & Lifestyle Disorders'],
       'Dinacharya-based lifestyle and diet counselling at Guru Ravidas Ayurved University, Hoshiarpur',
       'Swasthya Ayurveda Lifestyle Clinic', 'Ferozepur Road, Ludhiana, Punjab 141001',
       10, '600', array['video', 'in-person'], array['English', 'Hindi', 'Punjabi'],
       array['PCOS', 'Thyroid Imbalance', 'Weight Management', 'Insulin Resistance'],
       '+91 161 240 7718', 'Tue-Sun, 10:00 AM - 7:00 PM',
       array['BAMS - Guru Ravidas Ayurved University, Hoshiarpur (2012)',
             'MD (Ayurveda) Swasthavritta & Yoga - Guru Ravidas Ayurved University, Hoshiarpur (2015)'],
       'Preventive-health specialist working with young women on PCOS, thyroid imbalance and weight. Builds sustainable meal and routine plans rather than short restrictive diets, and tracks cycles and symptoms over months.',
       4.7, 98, 640, '2015-07-14', 'Board of Ayurvedic and Unani Systems of Medicine, Punjab'),

      ('farah.siddiqui.demo@prakriva.app', 'Dr. Farah Siddiqui', 'AYU/UP/152733', 2012,
       'MD (Ayurveda) - Dravyaguna, Faculty of Ayurveda, IMS, Banaras Hindu University',
       array['Dravyaguna (Herbal Medicine)', 'Digestive Health', 'Twak Roga (Skin & Hair)'],
       'Herbal formulation and Agni-focused digestive care at the Faculty of Ayurveda, BHU, Varanasi',
       'Ayushmaan Ayurveda Clinic', 'Hazratganj, Lucknow, Uttar Pradesh 226001',
       13, '700', array['in-person', 'video'], array['English', 'Hindi', 'Urdu'],
       array['Irritable Bowel Syndrome', 'Acne', 'Hair Fall', 'Acid Reflux'],
       '+91 522 262 5514', 'Mon-Sat, 11:00 AM - 7:00 PM',
       array['BAMS - State Ayurvedic College, Lucknow (2009)',
             'MD (Ayurveda) Dravyaguna - Banaras Hindu University (2012)'],
       'Ayurvedic physician with a herbal-medicine background, treating digestive complaints and the skin and hair problems that often travel with them. Emphasises restoring Agni through diet before adding formulations.',
       4.5, 76, 520, '2012-08-30', 'Board of Indian Medicine, Uttar Pradesh')
    ) as t(email, name, license, grad_year, certification, specialization, training,
           clinic, address, experience, fee, modes, languages, conditions,
           phone, hours, education, bio, rating, reviews, consultations,
           registration_date, council)
  loop
    uid := pg_temp.demo_account(d.email, demo_password, jsonb_build_object(
      'role', 'doctor',
      'name', d.name,
      'licenseNumber', d.license,
      'medicalCouncil', 'ayush',
      'graduationYear', d.grad_year,
      'medicalDegree', 'md',
      'ayurvedicCertification', d.certification,
      'ayurvedicSpecialization', to_jsonb(d.specialization),
      'traditionalTraining', d.training,
      'clinicName', d.clinic,
      'clinicAddress', d.address,
      'yearsOfExperience', d.experience,
      'consultationFee', d.fee,
      'consultationModes', to_jsonb(d.modes),
      'languages', to_jsonb(d.languages),
      'specialConditions', to_jsonb(d.conditions)
    ));

    update public.doctors set
      is_demo             = true,
      phone_number        = d.phone,
      working_hours       = d.hours,
      education           = d.education,
      bio                 = d.bio,
      rating              = d.rating,
      total_reviews       = d.reviews,
      total_consultations = d.consultations,
      is_active           = true
    where id = uid;

    perform public.verify_doctor(uid, true, jsonb_build_object(
      'verifiedName',       d.name,
      'registrationDate',   d.registration_date,
      'councilStatus',      'active',
      'verifyingCouncil',   d.council,
      'verificationMethod', 'manual_admin_review',
      'note',               'Seeded demonstration account - fictional practitioner, not a real registration'
    ));
  end loop;

  -- -------------------------------------------------------------------------
  -- 2. Six demonstration patients, each with a completed questionnaire, and a
  --    consultation request to Dr. Rajesh Kumar.
  --
  --    assessment_data holds the questionnaire's own fields and values (see
  --    src/pages/patient/Questionnaire.tsx), so the dosha scoring, diet chart
  --    targets and chatbot read them exactly as they read a real patient's.
  --    Due dates are relative to today, so the trimester stays right whenever
  --    this is run.
  -- -------------------------------------------------------------------------
  for p in
    select * from (values
      ('kavya.reddy.patient.demo@prakriva.app', 'Kavya Reddy', '["pregnancy"]'::jsonb,
       jsonb_build_object(
         'name', 'Kavya Reddy', 'dob', '1997-04-12', 'gender', 'female', 'location', 'Hyderabad, Telangana',
         'heightCm', '160', 'weightKg', '58',
         'lifeStage', 'pregnancy', 'pregnancyTrimester', 'second',
         'dueDate', to_char(current_date + 126, 'YYYY-MM-DD'),
         'allergies', '[]'::jsonb, 'dietaryPreferences', 'vegetarian',
         'familyHistory', '["diabetes"]'::jsonb,
         'bodyFrame', 'medium', 'skinType', 'oily', 'hairType', 'fine', 'appetitePattern', 'strong',
         'personalityTraits', '["ambitious", "focused"]'::jsonb, 'weatherPreference', 'cool',
         'currentConditions', '["Iron-deficiency anaemia"]'::jsonb,
         'digestionIssues', '["Acidity"]'::jsonb,
         'healthGoals', '["Healthy pregnancy", "Improve iron levels"]'::jsonb,
         'physicalActivity', 'light', 'sleepDuration', '7', 'energyLevels', 2, 'stressLevels', 3,
         'primaryDosha', 'pitta'),
       'accepted', 'consultation', 'medium', 'video', 6,
       'Second trimester. My last blood test showed low haemoglobin and I get tired by the afternoon. I would like a vegetarian diet plan that helps my iron levels.',
       '+91 98480 21673', 'B+'),

      ('pooja.iyer.patient.demo@prakriva.app', 'Pooja Iyer', '["pregnancy", "pcos"]'::jsonb,
       jsonb_build_object(
         'name', 'Pooja Iyer', 'dob', '1993-09-03', 'gender', 'female', 'location', 'Chennai, Tamil Nadu',
         'heightCm', '158', 'weightKg', '74',
         'lifeStage', 'pregnancy', 'pregnancyTrimester', 'third',
         'dueDate', to_char(current_date + 56, 'YYYY-MM-DD'),
         'allergies', '["peanuts"]'::jsonb, 'dietaryPreferences', 'vegetarian',
         'familyHistory', '["diabetes", "thyroid"]'::jsonb,
         'bodyFrame', 'large', 'skinType', 'normal', 'hairType', 'thick', 'appetitePattern', 'slow',
         'personalityTraits', '["calm", "steady"]'::jsonb, 'weatherPreference', 'warm',
         'currentConditions', '["PCOS", "Gestational diabetes (diet-controlled)"]'::jsonb,
         'digestionIssues', '["Constipation"]'::jsonb,
         'healthGoals', '["Blood sugar control", "Healthy weight gain"]'::jsonb,
         'physicalActivity', 'light', 'sleepDuration', '6', 'energyLevels', 3, 'stressLevels', 4,
         'primaryDosha', 'kapha'),
       'accepted', 'dietitian', 'high', 'video', 4,
       'Diagnosed with gestational diabetes at 28 weeks, currently diet-controlled. I have PCOS too. I need help planning meals that keep my sugar steady without feeling hungry.',
       '+91 98410 55382', 'O+'),

      ('aisha.khan.patient.demo@prakriva.app', 'Aisha Khan', '["pcos"]'::jsonb,
       jsonb_build_object(
         'name', 'Aisha Khan', 'dob', '1998-01-22', 'gender', 'female', 'location', 'New Delhi',
         'heightCm', '163', 'weightKg', '71',
         'lifeStage', 'none',
         'allergies', '["shellfish"]'::jsonb, 'dietaryPreferences', 'non-vegetarian',
         'familyHistory', '["diabetes"]'::jsonb,
         'bodyFrame', 'large', 'skinType', 'oily', 'hairType', 'thick', 'appetitePattern', 'slow',
         'personalityTraits', '["steady", "calm"]'::jsonb, 'weatherPreference', 'warm',
         'currentConditions', '["PCOS", "Insulin resistance"]'::jsonb,
         'digestionIssues', '["Bloating"]'::jsonb,
         'healthGoals', '["Regular cycles", "Weight management"]'::jsonb,
         'physicalActivity', 'moderate', 'sleepDuration', '7', 'energyLevels', 3, 'stressLevels', 3,
         'primaryDosha', 'kapha'),
       'pending', 'dietitian', 'medium', 'video', 2,
       'Diagnosed with PCOS last year. My cycles are 40-50 days apart and I have gained weight. Looking for an Ayurvedic diet I can actually stick to.',
       '+91 98110 74426', 'A+'),

      ('neha.bansal.patient.demo@prakriva.app', 'Neha Bansal', '[]'::jsonb,
       jsonb_build_object(
         'name', 'Neha Bansal', 'dob', '1990-06-15', 'gender', 'female', 'location', 'Jaipur, Rajasthan',
         'heightCm', '155', 'weightKg', '49',
         'lifeStage', 'none',
         'allergies', '["dairy"]'::jsonb, 'dietaryPreferences', 'vegetarian',
         'familyHistory', '[]'::jsonb,
         'bodyFrame', 'thin', 'skinType', 'dry', 'hairType', 'dry', 'appetitePattern', 'variable',
         'personalityTraits', '["creative", "anxious"]'::jsonb, 'weatherPreference', 'warm',
         'currentConditions', '["Irritable bowel syndrome"]'::jsonb,
         'digestionIssues', '["Bloating", "Irregular bowel movements"]'::jsonb,
         'healthGoals', '["Better digestion", "Less bloating"]'::jsonb,
         'physicalActivity', 'light', 'sleepDuration', '6', 'energyLevels', 2, 'stressLevels', 4,
         'primaryDosha', 'vata'),
       'pending', 'consultation', 'low', 'in-person', 1,
       'Bloating most evenings and irregular digestion for about a year. I avoid dairy because it makes it worse. Would like to understand what suits my body type.',
       '+91 94140 63390', 'AB+'),

      ('ritu.malhotra.patient.demo@prakriva.app', 'Ritu Malhotra', '["pcos"]'::jsonb,
       jsonb_build_object(
         'name', 'Ritu Malhotra', 'dob', '1996-11-08', 'gender', 'female', 'location', 'Pune, Maharashtra',
         'heightCm', '167', 'weightKg', '62',
         'lifeStage', 'none',
         'allergies', '[]'::jsonb, 'dietaryPreferences', 'vegan',
         'familyHistory', '["thyroid"]'::jsonb,
         'bodyFrame', 'medium', 'skinType', 'oily', 'hairType', 'fine', 'appetitePattern', 'strong',
         'personalityTraits', '["irritable", "quick-thinking"]'::jsonb, 'weatherPreference', 'cool',
         'currentConditions', '["PCOS", "Acne"]'::jsonb,
         'digestionIssues', '["Acidity"]'::jsonb,
         'healthGoals', '["Clearer skin", "Regular cycles"]'::jsonb,
         'physicalActivity', 'active', 'sleepDuration', '7', 'energyLevels', 4, 'stressLevels', 3,
         'primaryDosha', 'pitta'),
       'pending', 'dietitian', 'medium', 'video', 0,
       'Vegan, with PCOS and persistent acne along my jaw. Want a plan that is plant-based but still gets enough protein.',
       '+91 98220 41157', 'O-'),

      ('sana.sheikh.patient.demo@prakriva.app', 'Sana Sheikh', '["pregnancy"]'::jsonb,
       jsonb_build_object(
         'name', 'Sana Sheikh', 'dob', '1999-03-30', 'gender', 'female', 'location', 'Mumbai, Maharashtra',
         'heightCm', '159', 'weightKg', '52',
         'lifeStage', 'pregnancy', 'pregnancyTrimester', 'first',
         'dueDate', to_char(current_date + 210, 'YYYY-MM-DD'),
         'allergies', '["eggs"]'::jsonb, 'dietaryPreferences', 'non-vegetarian',
         'familyHistory', '[]'::jsonb,
         'bodyFrame', 'thin', 'skinType', 'dry', 'hairType', 'dry', 'appetitePattern', 'variable',
         'personalityTraits', '["creative", "anxious"]'::jsonb, 'weatherPreference', 'warm',
         'currentConditions', '["Morning sickness"]'::jsonb,
         'digestionIssues', '["Nausea"]'::jsonb,
         'healthGoals', '["Manage nausea", "Healthy pregnancy"]'::jsonb,
         'physicalActivity', 'light', 'sleepDuration', '8', 'energyLevels', 2, 'stressLevels', 3,
         'primaryDosha', 'vata'),
       'pending', 'consultation', 'high', 'video', 0,
       'Ten weeks pregnant with strong nausea most of the day - I can barely keep breakfast down. Need advice on what to eat that will stay down.',
       '+91 98190 26618', 'B-')
    ) as t(email, name, tracks, assessment, status, request_type, urgency, mode, days_ago,
           message, phone, blood_group)
  loop
    uid := pg_temp.demo_account(p.email, demo_password,
      jsonb_build_object('role', 'patient', 'name', p.name, 'healthTracks', p.tracks));

    update public.patients set
      assessment_data         = coalesce(assessment_data, '{}'::jsonb) || p.assessment,
      questionnaire_completed = true,
      assessment_completed_at = coalesce(assessment_completed_at, now())
    where id = uid;

    if not exists (
      select 1 from public.consultation_requests where patient_id = uid and doctor_id = rajesh.id
    ) then
      insert into public.consultation_requests (
        patient_id, patient_name, patient_email, patient_phone,
        doctor_id, doctor_name, doctor_email,
        request_type, urgency, message, preferred_consultation_mode,
        status, patient_notified, doctor_notified,
        full_patient_profile, requested_at, status_updated_at
      ) values (
        uid, p.name, p.email, p.phone,
        rajesh.id, rajesh.name, rajesh.email,
        p.request_type, p.urgency, p.message, p.mode,
        p.status, p.status = 'accepted', false,
        jsonb_build_object(
          'name', p.name,
          'email', p.email,
          'age', date_part('year', age(current_date, (p.assessment ->> 'dob')::date))::int,
          'gender', 'female',
          'phoneNumber', p.phone,
          'address', p.assessment ->> 'location',
          'bloodGroup', p.blood_group,
          'emergencyContact', null,
          'medicalHistory', coalesce(p.assessment -> 'currentConditions', '[]'::jsonb),
          'allergies', coalesce(p.assessment -> 'allergies', '[]'::jsonb),
          'currentMedications', '[]'::jsonb,
          'assessmentData', p.assessment
        ),
        -- Staggered so the dashboard lists them newest first, a few hours apart.
        now() - make_interval(days => p.days_ago, hours => 2 + p.days_ago),
        case when p.status = 'accepted'
             then now() - make_interval(days => greatest(p.days_ago - 1, 0))
        end
      );
      inserted := inserted + 1;
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- 3. A recent screening for each pregnant patient, run by Dr. Rajesh, in
  --    the pipeline's own result shape (backend/disease_detection/schemas.py).
  --    Kavya: anaemia high. Pooja: gestational diabetes moderate. Sana: low.
  -- -------------------------------------------------------------------------
  insert into public.disease_screenings (
    patient_id, doctor_id, submitted_by, inputs, result, overall_risk_level,
    highest_risk_condition, created_at
  )
  select pt.id, rajesh.id, 'doctor', s.inputs,
         jsonb_build_object(
           'generated_at', now() - make_interval(days => s.days_ago),
           'overall_risk_level', s.overall,
           'highest_risk_condition', s.highest,
           'disclaimer', 'These scores are decision aids for a clinician, not a diagnosis.',
           'conditions', s.conditions),
         s.overall, s.highest, now() - make_interval(days => s.days_ago)
    from (values
      ('kavya.reddy.patient.demo@prakriva.app', 3, 'high', 'anaemia',
       '{"age": 29, "trimester": "second", "bmi": 22.7, "hemoglobin": 9.1, "systolic_bp": 112, "diastolic_bp": 72}'::jsonb,
       '[{"condition":"anaemia","label":"Anaemia","score":86,"risk_level":"high","detector":"anaemia-xgb-v1","details":{},
          "reasons":["Haemoglobin 9.1 g/dL, below 10.5 g/dL for the second trimester"],
          "recommendations":["Start iron supplementation and repeat haemoglobin in 4 weeks","Iron-rich foods with vitamin C at the same meal; keep tea and coffee away from meals"]},
         {"condition":"pregnancy_risk","label":"Pregnancy Risk","score":22,"risk_level":"low","detector":"pregnancy-risk-xgb-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"gdm","label":"Gestational Diabetes","score":18,"risk_level":"low","detector":"gdm-logreg-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"preeclampsia","label":"Preeclampsia","score":9,"risk_level":"low","detector":"preeclampsia-logreg-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"uti","label":"Urinary Tract Infection","score":5,"risk_level":"low","detector":"detect_uti","details":{},"reasons":[],"recommendations":[]},
         {"condition":"thyroid","label":"Thyroid Disorder","score":11,"risk_level":"low","detector":"thyroid-nn-v1","details":{},"reasons":[],"recommendations":[]}]'::jsonb),

      ('pooja.iyer.patient.demo@prakriva.app', 2, 'moderate', 'gdm',
       '{"age": 33, "trimester": "third", "bmi": 29.6, "hemoglobin": 11.4, "fasting_glucose": 98, "systolic_bp": 124, "diastolic_bp": 80}'::jsonb,
       '[{"condition":"gdm","label":"Gestational Diabetes","score":58,"risk_level":"moderate","detector":"gdm-logreg-v1","details":{},
          "reasons":["Fasting glucose 98 mg/dL, above the 92 mg/dL threshold","BMI 29.6 and a history of PCOS"],
          "recommendations":["Continue diet control with 3 meals and 2-3 snacks; avoid refined sugar and large rice portions","Self-monitor fasting and post-meal glucose; review in 2 weeks"]},
         {"condition":"anaemia","label":"Anaemia","score":20,"risk_level":"low","detector":"anaemia-xgb-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"pregnancy_risk","label":"Pregnancy Risk","score":31,"risk_level":"low","detector":"pregnancy-risk-xgb-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"preeclampsia","label":"Preeclampsia","score":24,"risk_level":"low","detector":"preeclampsia-logreg-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"uti","label":"Urinary Tract Infection","score":6,"risk_level":"low","detector":"detect_uti","details":{},"reasons":[],"recommendations":[]},
         {"condition":"thyroid","label":"Thyroid Disorder","score":17,"risk_level":"low","detector":"thyroid-nn-v1","details":{},"reasons":[],"recommendations":[]}]'::jsonb),

      ('sana.sheikh.patient.demo@prakriva.app', 1, 'low', null,
       '{"age": 27, "trimester": "first", "bmi": 20.6, "hemoglobin": 11.8, "systolic_bp": 108, "diastolic_bp": 70}'::jsonb,
       '[{"condition":"anaemia","label":"Anaemia","score":14,"risk_level":"low","detector":"anaemia-xgb-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"pregnancy_risk","label":"Pregnancy Risk","score":12,"risk_level":"low","detector":"pregnancy-risk-xgb-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"gdm","label":"Gestational Diabetes","score":8,"risk_level":"low","detector":"gdm-logreg-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"preeclampsia","label":"Preeclampsia","score":6,"risk_level":"low","detector":"preeclampsia-logreg-v1","details":{},"reasons":[],"recommendations":[]},
         {"condition":"uti","label":"Urinary Tract Infection","score":4,"risk_level":"low","detector":"detect_uti","details":{},"reasons":[],"recommendations":[]},
         {"condition":"thyroid","label":"Thyroid Disorder","score":9,"risk_level":"low","detector":"thyroid-nn-v1","details":{},"reasons":[],"recommendations":[]}]'::jsonb)
    ) as s(email, days_ago, overall, highest, inputs, conditions)
    join public.patients pt on pt.email = s.email
   where not exists (select 1 from public.disease_screenings ds where ds.patient_id = pt.id);

  -- -------------------------------------------------------------------------
  -- 4. A stocked kitchen for the two accepted patients, so the AI diet chart
  --    can build meals around what they already have.
  -- -------------------------------------------------------------------------
  insert into public.patient_pantry_items (patient_id, food_name, search_term, category, availability)
  select pt.id, k.food_name, k.search_term, k.category, k.availability
    from (values
      ('kavya.reddy.patient.demo@prakriva.app', 'Rice (white)', 'rice', 'Grains & Cereals', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Toor dal (arhar)', 'lentil', 'Dals & Legumes', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Chickpeas (kabuli chana)', 'chickpea', 'Dals & Legumes', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Spinach', 'spinach', 'Vegetables', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Carrot', 'carrot', 'Vegetables', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Curd / yogurt', 'yogurt', 'Dairy & Eggs', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Ghee', 'ghee', 'Oils & Fats', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Almonds', 'almond', 'Nuts & Seeds', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Banana', 'banana', 'Fruits', 'at_home'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Oats', 'oat', 'Grains & Cereals', 'to_buy'),
      ('kavya.reddy.patient.demo@prakriva.app', 'Walnuts', 'walnut', 'Nuts & Seeds', 'to_buy'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Brown rice', 'rice', 'Grains & Cereals', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Oats', 'oat', 'Grains & Cereals', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Masoor dal (red lentil)', 'lentil', 'Dals & Legumes', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Chana dal', 'chickpea', 'Dals & Legumes', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Spinach', 'spinach', 'Vegetables', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Ginger', 'ginger', 'Vegetables', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Curd / yogurt', 'yogurt', 'Dairy & Eggs', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Milk', 'milk', 'Dairy & Eggs', 'at_home'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Quinoa', 'quinoa', 'Grains & Cereals', 'to_buy'),
      ('pooja.iyer.patient.demo@prakriva.app', 'Sweet potato', 'sweet potato', 'Vegetables', 'to_buy')
    ) as k(email, food_name, search_term, category, availability)
    join public.patients pt on pt.email = k.email
   where not exists (
     select 1 from public.patient_pantry_items i
      where i.patient_id = pt.id and i.food_name = k.food_name
   );

  raise notice 'Demo data ready: % new consultation request(s) to %.', inserted, rajesh.name;
end;
$$;

commit;

-- What was created (read-only).
select cr.patient_name, cr.status, cr.request_type, cr.urgency, cr.requested_at
  from public.consultation_requests cr
  join public.doctors d on d.id = cr.doctor_id
 where d.email = 'rajesh.kumar.demo@prakriva.app'
   and cr.patient_email like '%.patient.demo@prakriva.app'
 order by cr.requested_at desc;

-- ---------------------------------------------------------------------------
-- REMOVING THE DEMO DATA. Every row above hangs off these accounts with
-- ON DELETE CASCADE, so deleting them removes their patients/doctors rows,
-- requests, screenings and kitchen items too:
--
--   delete from auth.users
--    where email like '%.patient.demo@prakriva.app'
--       or email in ('ananya.deshpande.demo@prakriva.app', 'sameer.joshi.demo@prakriva.app',
--                    'harpreet.kaur.demo@prakriva.app', 'farah.siddiqui.demo@prakriva.app');
-- ---------------------------------------------------------------------------
