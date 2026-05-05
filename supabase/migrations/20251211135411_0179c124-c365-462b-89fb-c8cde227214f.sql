-- Update APHA Western Riding project to use correct user_id
UPDATE projects 
SET user_id = '09f47f1a-5ecd-4d99-8994-a9499990ee8b'
WHERE id = 'b3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e';

-- Also update AQHA project if needed
UPDATE projects 
SET user_id = '09f47f1a-5ecd-4d99-8994-a9499990ee8b'
WHERE id = '2b214343-4719-4159-923c-88fc9d23c5fe';