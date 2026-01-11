-- Add UNIQUE constraint to email field in users table
-- This ensures no two users can have the same email address

ALTER TABLE users 
ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Add email validation (format check)
ALTER TABLE users
ADD CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL);
