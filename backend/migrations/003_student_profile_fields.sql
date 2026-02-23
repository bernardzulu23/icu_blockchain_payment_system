-- Add student profile fields (admin-set, read-only for students)
-- Profile picture is editable by student

ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_semester INTEGER CHECK (current_semester >= 1 AND current_semester <= 12);
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_term INTEGER CHECK (current_term >= 1 AND current_term <= 3);
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);
