-- Seed demo profiles so the discovery deck isn't empty during development.
--
-- These are throwaway demo accounts (emails @zapdemo.app, password "demo123456").
-- Profiles reference auth.users(id), so we create matching auth.users rows first.
--
-- To remove all demo data later, run:
--   delete from auth.users where email like '%@zapdemo.app';
-- (profiles/swipes/connections cascade on delete).

do $$
declare
  demo record;
  v_user_id uuid;
begin
  for demo in
    select * from (values
      ('11111111-0000-4000-8000-000000000001'::uuid, 'ava@zapdemo.app',     'Ava Chen',        'Product Designer',     'Design',       'mid',     'I design calm, human interfaces. Previously at a fintech, now exploring health tech.', 'Design systems and how to scale them without killing creativity.', 'Motion design and Rive.',           'A weekly newsletter on design ethics.',   1),
      ('11111111-0000-4000-8000-000000000002'::uuid, 'marcus@zapdemo.app',  'Marcus Reid',     'Backend Engineer',     'Tech',         'senior',  'Distributed systems person who likes mentoring. Coffee snob, amateur potter.',          'Scaling Postgres and event-driven systems.',                       'Rust and embedded.',                'An open-source job queue.',                12),
      ('11111111-0000-4000-8000-000000000003'::uuid, 'priya@zapdemo.app',   'Priya Nair',      'Founder & CEO',        'Climate',      'founder', 'Building tools to make carbon accounting boring and reliable. Ex-consultant.',          'Going from 0 to 1 in climate.',                                    'Fundraising storytelling.',         'A community for climate founders.',        5),
      ('11111111-0000-4000-8000-000000000004'::uuid, 'diego@zapdemo.app',   'Diego Alvarez',   'Data Scientist',       'Healthcare',   'mid',     'ML for diagnostics. I care about models people can actually trust and explain.',        'Causal inference and clinical data.',                              'LLM evals.',                        'A side project visualizing hospital wait times.', 13),
      ('11111111-0000-4000-8000-000000000005'::uuid, 'sofia@zapdemo.app',   'Sofia Marino',    'Marketing Lead',       'Media',        'senior',  'Brand and growth storyteller. I help technical teams sound human.',                      'Positioning and narrative for hard products.',                     'Short-form video.',                 'A podcast on career pivots.',              16),
      ('11111111-0000-4000-8000-000000000006'::uuid, 'noah@zapdemo.app',    'Noah Kim',        'Student',              'Tech',         'student', 'CS senior trying to figure out research vs industry. I build little games for fun.',     'Breaking into industry from school.',                              'Graphics programming.',             'A pixel-art roguelike.',                   3),
      ('11111111-0000-4000-8000-000000000007'::uuid, 'lena@zapdemo.app',    'Lena Fischer',    'UX Researcher',        'Design',       'mid',     'I talk to users for a living and translate messiness into clarity.',                     'Running research with tiny budgets.',                              'Quant + qual mixed methods.',       'A repository of research templates.',      9),
      ('11111111-0000-4000-8000-000000000008'::uuid, 'omar@zapdemo.app',    'Omar Haddad',     'Product Manager',      'Fintech',      'mid',     'PM who used to be an engineer. I like ambiguous problems and clear roadmaps.',           'Zero-to-one product discovery.',                                   'Behavioral economics.',             'A budgeting app for freelancers.',         8),
      ('11111111-0000-4000-8000-000000000009'::uuid, 'grace@zapdemo.app',   'Grace Okoro',     'Frontend Engineer',    'Tech',         'early',   'React + animations enthusiast. I make interfaces feel alive.',                           'Building delightful micro-interactions.',                          'WebGL and shaders.',                'An open-source component library.',         10),
      ('11111111-0000-4000-8000-000000000010'::uuid, 'theo@zapdemo.app',    'Theo Lindqvist',  'Investor',             'Venture',      'senior',  'Early-stage investor, former operator. Happy to chat with curious builders.',           'What makes a great early team.',                                   'Dev tools and AI infra.',           'Angel investing in climate.',              15),
      ('11111111-0000-4000-8000-000000000011'::uuid, 'maya@zapdemo.app',    'Maya Patel',      'Career Changer',       'Education',    'early',   'Former teacher now learning to code. Big on curiosity over credentials.',               'Switching careers without a CS degree.',                           'Full-stack JavaScript.',            'A tutoring marketplace.',                  20),
      ('11111111-0000-4000-8000-000000000012'::uuid, 'sam@zapdemo.app',     'Sam Rivera',      'DevRel Engineer',      'Tech',         'mid',     'I live between code and community. I love demystifying hard tech.',                      'Building developer communities.',                                  'Technical writing.',                'A YouTube channel on system design.',      11)
    ) as t(id, email, display_name, role_title, industry, experience_level, bio, ask_me_about, learning_about, side_project, avatar)
  loop
    v_user_id := demo.id;

    -- Create the auth user (idempotent). Password = "demo123456".
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      demo.email,
      extensions.crypt('demo123456', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', demo.display_name),
      now(),
      now()
    )
    on conflict (id) do nothing;

    -- Create/refresh the public profile.
    insert into public.profiles (
      user_id, display_name, role_title, industry, experience_level,
      bio, photo_url, ask_me_about, learning_about, side_project, is_complete
    )
    values (
      v_user_id, demo.display_name, demo.role_title, demo.industry, demo.experience_level,
      demo.bio,
      'https://i.pravatar.cc/600?img=' || demo.avatar,
      demo.ask_me_about, demo.learning_about, demo.side_project, true
    )
    on conflict (user_id) do update
      set display_name = excluded.display_name,
          role_title = excluded.role_title,
          industry = excluded.industry,
          experience_level = excluded.experience_level,
          bio = excluded.bio,
          photo_url = excluded.photo_url,
          ask_me_about = excluded.ask_me_about,
          learning_about = excluded.learning_about,
          side_project = excluded.side_project,
          is_complete = true;
  end loop;
end $$;
