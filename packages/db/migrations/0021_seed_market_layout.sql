-- Default /market rails when no market surface rows exist yet
INSERT INTO homepage_layout_sections (section_type, title, description, display_order, is_active, surface)
SELECT v.section_type, v.title, v.description, v.display_order, true, 'market'
FROM (
  VALUES
    ('featured_carousel'::text, 'Featured'::text, NULL::text, 0::integer),
    ('ending_soon'::text, 'Ending soon'::text, 'Auctions closing in the next 7 days'::text, 1::integer),
    ('live_bids'::text, 'Live bids'::text, NULL::text, 2::integer),
    ('awaiting_bids'::text, 'Awaiting bids'::text, 'Active listings with no bids yet'::text, 3::integer),
    ('recently_concluded'::text, 'Recently sold'::text, NULL::text, 4::integer)
) AS v(section_type, title, description, display_order)
WHERE NOT EXISTS (SELECT 1 FROM homepage_layout_sections WHERE surface = 'market' LIMIT 1);
