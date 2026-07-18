-- Seed data for AURA Health Platform

INSERT INTO platform_content (kind, title, body, sort_order) VALUES
('problem', 'Reactive healthcare', 'Care often begins after symptoms escalate, missing the window for prevention.', 1),
('problem', 'Fragmented records', 'Reports, prescriptions, wearables, and habits live in disconnected systems.', 2),
('problem', 'Complex reports', 'Clinical language leaves people unsure what results mean for daily life.', 3),
('problem', 'Limited consultation time', 'Important context can be lost during brief, high-pressure appointments.', 4),
('problem', 'Generic advice', 'One-size guidance overlooks individual history, goals, and constraints.', 5),
('problem', 'Lifestyle disease burden', 'Slow-moving risks need continuous intelligence, not occasional snapshots.', 6),
('workflow', 'User data', 'Records, habits & wearables', 10),
('workflow', 'AI processing', 'Secure normalization', 11),
('workflow', 'Digital Twin', 'Living health model', 12),
('workflow', 'Multi-Agent AI', 'Specialist reasoning', 13),
('workflow', 'Personalized insight', 'Clear next steps', 14),
('workflow', 'Better health', 'Proactive decisions', 15),
('timeline', 'Connect the full picture', 'AURA combines clinical history, lifestyle, nutrition, sleep, movement and wearable signals.', 20),
('timeline', 'Build your Digital Twin', 'A dynamic health model adapts whenever your signals, goals, or care plan changes.', 21),
('timeline', 'Reason with specialist agents', 'Doctor, Nutrition, Fitness, Medication, and Prediction Agents collaborate with shared context.', 22),
('timeline', 'Act before risk becomes illness', 'Understand trends early and bring better questions and evidence to qualified clinicians.', 23);

INSERT INTO health_metrics (metric, value, unit, change, trend) VALUES
('Health Score', 87, '', '+4 this week', '[72, 74, 77, 75, 81, 84, 87]'),
('Sleep Score', 82, '', '+6%', '[67, 71, 69, 76, 78, 80, 82]'),
('Activity', 7420, 'steps', '+12%', '[4300, 5900, 5100, 6800, 7200, 6300, 7420]'),
('Water', 2.1, 'L', '84% goal', '[1.3, 1.5, 1.6, 1.8, 2, 1.9, 2.1]'),
('Calories', 1840, 'kcal', 'Balanced', '[1700, 1820, 1950, 1780, 1880, 1810, 1840]'),
('Stress', 28, 'low', '-9%', '[46, 42, 38, 40, 34, 31, 28]'),
('Heart Rate', 72, 'bpm', 'Stable', '[75, 73, 77, 72, 71, 74, 72]');

INSERT INTO appointments (doctor, specialty, day, month, time) VALUES
('Dr. Maya Chen', 'Internal Medicine', '18', 'MAR', '10:30 AM'),
('Dr. Arjun Mehta', 'Endocrinology', '02', 'APR', '3:00 PM');

INSERT INTO medications (name, dose, schedule, taken) VALUES
('Metformin', '500 mg', '8:00 AM - With breakfast', true),
('Vitamin D3', '1000 IU', '1:00 PM - After lunch', false),
('Lisinopril', '10 mg', '9:00 PM - Nightly', false);

INSERT INTO health_timeline (time, title, detail) VALUES
('7:42 AM', 'Sleep synced', '7h 38m - 91% efficiency'),
('8:15 AM', 'Medication logged', 'Metformin taken on time'),
('9:30 AM', 'Morning walk', '2,840 steps - moderate pace'),
('11:10 AM', 'Twin updated', 'Recovery outlook improved');

INSERT INTO risk_trends (name, status, level) VALUES
('Cardiovascular', 'Stable over 30 days', 'Low'),
('Metabolic', 'Improving with activity', 'Medium'),
('Sleep deficit', 'Down 18% this month', 'Low'),
('Stress load', 'Monitor workday peaks', 'Medium');

INSERT INTO chat_messages (role, content, language) VALUES
('assistant', 'Good morning, Alex. Your recovery indicators improved overnight and your resting heart rate is stable. What would you like to understand today?', 'English'),
('user', 'How can I improve my energy in the afternoon?', 'English'),
('assistant', 'Your recent patterns suggest three low-risk experiments: keep lunch balanced with protein and fiber, take a 10-minute walk afterward, and hydrate before 2 PM. Your sleep timing also matters more than total duration this week.', 'English');

INSERT INTO medical_reports (file_name, file_url, status, summary, extracted) VALUES
('Annual_Blood_Panel_2026.pdf', '#', 'Analyzed', 'Most values are within range. HbA1c is mildly elevated and Vitamin D is below the lab reference range; discuss both with your clinician.', '{"parameters": [{"name": "Hemoglobin", "value": "13.8 g/dL", "status": "Normal"}, {"name": "HbA1c", "value": "6.1%", "status": "Attention"}, {"name": "Vitamin D", "value": "24 ng/mL", "status": "Low"}]}');

INSERT INTO condition_logs (condition_name, value, unit, logged_at, status) VALUES
('Blood Pressure', '118/76', 'mmHg', '2026-03-13T08:15:00Z', 'In range'),
('Blood Sugar', '104', 'mg/dL', '2026-03-12T07:55:00Z', 'Recorded'),
('Blood Pressure', '122/79', 'mmHg', '2026-03-11T08:05:00Z', 'In range');

INSERT INTO lifestyle_simulations (scenario, projected_score, risk_reduction, timeline_weeks) VALUES
('8,000 steps daily and 20% less sugar', 86, 14, 12);

INSERT INTO patient_summaries (name, age, condition, risk, health_score, last_sync, ai_summary, recommendation, trend) VALUES
('Alex Morgan', 42, 'Prediabetes', 'Medium', 87, '2m ago', 'HbA1c remains mildly elevated, while activity consistency and sleep regularity improved over the last 21 days. No acute warning signals detected. Medication adherence is 86%.', 'Review nutrition targets and repeat HbA1c in 8-12 weeks', '[58, 62, 60, 65, 68, 64]'),
('Priya Sharma', 57, 'Hypertension', 'High', 64, '18m ago', 'Morning blood pressure has exceeded the personalized threshold on four of the last six days. Sodium estimates are elevated and two evening doses were missed.', 'Contact patient and review medication adherence today', '[45, 48, 54, 58, 67, 72]'),
('Jon Bell', 36, 'Asthma', 'Low', 91, '1h ago', 'Peak flow is stable with no increased rescue inhaler use. Activity tolerance improved and sleep interruption is down this month.', 'Continue current plan and monitor pollen exposure', '[22, 20, 18, 19, 15, 12]'),
('Elena Rossi', 68, 'Arthritis', 'Medium', 73, '3h ago', 'Pain scores are higher after low-activity days. No medication interaction concerns detected. Gentle mobility sessions correlate with better next-day function.', 'Review mobility plan and pain trend at next visit', '[40, 44, 39, 51, 48, 46]');

INSERT INTO agent_status (name, focus, status, latest_action, detail, updated) VALUES
('Doctor', 'Symptoms & history', 'Active', 'Reviewed metabolic pattern', 'Correlated recent HbA1c with activity and sleep signals.', '2m ago'),
('Nutrition', 'Diet intelligence', 'Active', 'Adjusted fiber target', 'Suggested a gradual increase based on meal patterns.', '4m ago'),
('Fitness', 'Movement & recovery', 'Active', 'Updated walking goal', 'Balanced activity load against recovery readiness.', '6m ago'),
('Medication', 'Safety & adherence', 'Monitoring', 'Checked interactions', 'No new interaction concerns across the active plan.', '11m ago'),
('Prediction', 'Risk forecasting', 'Active', 'Ran 12-week forecast', 'Modeled metabolic improvement under three scenarios.', '1m ago');

INSERT INTO audit_logs (event, actor, resource, time, status) VALUES
('Report analysis accessed', 'Dr. Maya Chen', 'Patient #AM-1042', '09:42', 'Verified'),
('Role permission updated', 'Admin - N. Rao', 'Doctor workspace', '09:18', 'Verified'),
('Digital Twin export', 'Alex Morgan', 'Personal health data', '08:56', 'Verified'),
('Agent policy evaluated', 'AURA Guardrail', 'Triage response #8821', '08:40', 'Passed'),
('New clinician invited', 'Admin - N. Rao', 'Care network', '08:21', 'Verified');

INSERT INTO wearable_devices (name, type, status, battery, last_sync, latest_data) VALUES
('AURA Pulse Band', 'Fitness band', 'Connected', 84, '4 minutes ago', '{"heart_rate": 72, "steps": 7420, "spo2": 98}'),
('Smart Body Scale', 'Bluetooth scale', 'Disconnected', 63, 'Yesterday, 7:20 AM', '{"weight_kg": 71.4, "body_fat": 18.2}');
