-- Only shared service categories are seeded. Users, workers, services, ratings,
-- reviews, bookings, and messages must come from real app activity.
INSERT INTO categories (name)
SELECT name
FROM unnest(ARRAY['Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Babysitting', 'Moving', 'Cooking']) AS name
WHERE NOT EXISTS (
  SELECT 1 FROM categories existing WHERE LOWER(existing.name) = LOWER(name.name)
);
