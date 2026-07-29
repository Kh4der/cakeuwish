-- Seed the admin backend with CakeUWish's current content.
-- Run AFTER 0001_init.sql. Safe to run more than once (on conflict do nothing).
-- Image paths point at the images already deployed in /public, so the live site
-- looks identical until you replace a photo from the admin panel.

insert into public.cakes (id, title, blurb, category, bg, panel, accent, dark, image, sort_order, visible) values
  ('5d2ec516-28dc-4e17-8801-5391e8a2f0c8', 'Farm Day, Reyaan',
   'A golden barnyard brought to life — cow-print tiers, miniature animals, and a red barn topper for a very happy fifth birthday.',
   'Kids & Character', '#EAD6A0', '#EBDFC4', '#A16207', false, '/cakes/5d2ec516-28dc-4e17-8801-5391e8a2f0c8/full.webp', 0, true),
  ('25e166a0-4076-4378-91d2-fd62b1890e46', 'She Has Range',
   'Ballet poise meets music royalty — hot-pink petal ruffles, designer accents, and a silhouette topper that knows exactly who the guest of honour is.',
   'Birthday Cakes', '#F0CBD6', '#EAD4D8', '#A16207', false, '/cakes/25e166a0-4076-4378-91d2-fd62b1890e46/full.webp', 1, true),
  ('a99e9e06-dbb2-4bde-8d13-f33521d03dfb', 'Fifty Golden Years',
   'Hand-piped gold lace, velvet-red roses, and lehenga grace as fine as the day they said yes — a golden anniversary deserves nothing less.',
   'Milestone & Anniversary', '#E8CFC4', '#E4D2CB', '#A16207', false, '/cakes/a99e9e06-dbb2-4bde-8d13-f33521d03dfb/full.webp', 2, true),
  ('ba90402b-d98e-4f7d-ab25-53200a10595b', 'Midnight Geode',
   'Matte black fondant, rose-gold geometry, fairy-lit acrylic, and hand-placed geode shards — for a milestone that refuses to be subtle.',
   'Milestone & Anniversary', '#1C1917', '#2A2522', '#CE8066', true, '/cakes/ba90402b-d98e-4f7d-ab25-53200a10595b/full.webp', 3, true),
  ('e135e65c-bac5-40fa-9acd-1dd74cc189ca', 'Together in Red & Gold',
   'A lehenga-draped silhouette cascading down ivory tiers, crowned with hand-sculpted bride and groom figurines — a cake that looks like their love story.',
   'Wedding Cakes', '#EDDBB4', '#EBDCC2', '#A16207', false, '/cakes/e135e65c-bac5-40fa-9acd-1dd74cc189ca/full.webp', 4, true),
  ('6a8115e3-88ee-4506-bda0-a6f4e7ec579c', 'Simply, Always',
   'Ivory buttercream, hand-ridged tiers, and a cascade of white garden roses — timeless, soft, and exactly right for the couple who lets the moment speak.',
   'Wedding Cakes', '#F3EDE1', '#F1EDE8', '#A16207', false, '/cakes/6a8115e3-88ee-4506-bda0-a6f4e7ec579c/full.webp', 5, true),
  ('8bf75c40-ca3c-4686-8f3c-70ff4bf73a6c', 'Semper Fi',
   'A tribute as sharp as dress blues — the Marine Corps emblem, a draped flag tier, and gold rope detailing for someone who earned every star.',
   'Theme & Novelty', '#CBD6E6', '#D8DCE2', '#44403C', false, '/cakes/8bf75c40-ca3c-4686-8f3c-70ff4bf73a6c/full.webp', 6, true)
on conflict (id) do nothing;

-- Showcase wall (deterministic ids from the path so re-running is idempotent).
insert into public.showcase_photos (id, src, alt, sort_order, visible) values
  (md5('/showcase/image_0.webp')::uuid,  '/showcase/image_0.webp',  'Custom celebration cake by CakeUWish', 0, true),
  (md5('/showcase/image_10.webp')::uuid, '/showcase/image_10.webp', 'Custom celebration cake by CakeUWish', 1, true),
  (md5('/showcase/image_11.webp')::uuid, '/showcase/image_11.webp', 'Custom celebration cake by CakeUWish', 2, true),
  (md5('/showcase/image_12.webp')::uuid, '/showcase/image_12.webp', 'Anniversary and Indian wedding cakes by CakeUWish', 3, true),
  (md5('/showcase/image_13.webp')::uuid, '/showcase/image_13.webp', 'Custom celebration cake by CakeUWish', 4, true),
  (md5('/showcase/image_14.webp')::uuid, '/showcase/image_14.webp', 'Custom celebration cake by CakeUWish', 5, true),
  (md5('/showcase/image_16.webp')::uuid, '/showcase/image_16.webp', 'Custom celebration cake by CakeUWish', 6, true),
  (md5('/showcase/image_17.webp')::uuid, '/showcase/image_17.webp', 'Custom celebration cake by CakeUWish', 7, true),
  (md5('/showcase/image_18.webp')::uuid, '/showcase/image_18.webp', 'Custom celebration cake by CakeUWish', 8, true),
  (md5('/showcase/image_19.webp')::uuid, '/showcase/image_19.webp', 'Paw Patrol birthday cake by CakeUWish', 9, true),
  (md5('/showcase/image_2.webp')::uuid,  '/showcase/image_2.webp',  'Custom celebration cake by CakeUWish', 10, true),
  (md5('/showcase/image_21.webp')::uuid, '/showcase/image_21.webp', 'Custom celebration cake by CakeUWish', 11, true),
  (md5('/showcase/image_22.webp')::uuid, '/showcase/image_22.webp', 'Custom celebration cake by CakeUWish', 12, true),
  (md5('/showcase/image_23.webp')::uuid, '/showcase/image_23.webp', 'Custom celebration cake by CakeUWish', 13, true),
  (md5('/showcase/image_24.webp')::uuid, '/showcase/image_24.webp', 'Custom celebration cake by CakeUWish', 14, true),
  (md5('/showcase/image_25.webp')::uuid, '/showcase/image_25.webp', 'Custom celebration cake by CakeUWish', 15, true),
  (md5('/showcase/image_3.webp')::uuid,  '/showcase/image_3.webp',  'Custom celebration cake by CakeUWish', 16, true),
  (md5('/showcase/image_4.webp')::uuid,  '/showcase/image_4.webp',  'Frozen castle birthday cake by CakeUWish', 17, true),
  (md5('/showcase/image_5.webp')::uuid,  '/showcase/image_5.webp',  'Custom celebration cake by CakeUWish', 18, true),
  (md5('/showcase/image_6.webp')::uuid,  '/showcase/image_6.webp',  'Custom celebration cake by CakeUWish', 19, true),
  (md5('/showcase/image_7.webp')::uuid,  '/showcase/image_7.webp',  'Custom celebration cake by CakeUWish', 20, true),
  (md5('/showcase/image_8.webp')::uuid,  '/showcase/image_8.webp',  'Custom celebration cake by CakeUWish', 21, true),
  (md5('/showcase/image_9.webp')::uuid,  '/showcase/image_9.webp',  'Custom celebration cake by CakeUWish', 22, true)
on conflict (id) do nothing;
