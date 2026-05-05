-- Clear existing data to prevent duplicates
TRUNCATE public.division_levels, public.divisions RESTART IDENTITY CASCADE;

DO $$
DECLARE
    -- Association Data
    aqha_id TEXT := 'AQHA';
    apha_id TEXT := 'APHA';
    aphc_id TEXT := 'ApHC';
    nsba_id TEXT := 'NSBA';
    phba_id TEXT := 'PHBA';
    ptha_id TEXT := 'PtHA';
    abra_id TEXT := 'ABRA';
    usef_id TEXT := 'USEF';
    ushja_id TEXT := 'USHJA';
    aha_id TEXT := 'AHA';
    isha_id TEXT := 'ISHA';
    four_h_id TEXT := '4-H';
    ncea_id TEXT := 'NCEA';
    vrh_id TEXT := 'versatility-ranch';
    open_show_id TEXT := 'open-unaffiliated';

    -- Helper procedure to insert divisions and levels
    PROCEDURE insert_division_data(
        p_assoc_id TEXT,
        p_div_name TEXT,
        p_div_sort_order INT,
        p_levels TEXT[]
    )
    LANGUAGE plpgsql
    AS $procedure_body$
    DECLARE
        new_div_id UUID;
        level_name TEXT;
        level_sort_order INT := 0;
    BEGIN
        -- Insert division and get its ID
        INSERT INTO public.divisions (id, association_id, name, sort_order)
        VALUES (gen_random_uuid(), p_assoc_id, p_div_name, p_div_sort_order)
        RETURNING id INTO new_div_id;

        -- Loop through levels and insert them
        FOREACH level_name IN ARRAY p_levels
        LOOP
            INSERT INTO public.division_levels (id, division_id, name, sort_order)
            VALUES (gen_random_uuid(), new_div_id, level_name, level_sort_order);
            level_sort_order := level_sort_order + 1;
        END LOOP;
    END;
    $procedure_body$;

BEGIN
    -- AQHA Data
    CALL insert_division_data(aqha_id, 'Open', 0, ARRAY['Open', 'Junior Horse', 'Senior Horse', 'L3 Open', 'L2 Open', 'L1 Open', 'Rookie Open']);
    CALL insert_division_data(aqha_id, 'Amateur', 1, ARRAY['Amateur', 'Select Amateur (50+)', 'L3 Amateur', 'L2 Amateur', 'L1 Amateur', 'Rookie Amateur', 'Walk-Trot Amateur']);
    CALL insert_division_data(aqha_id, 'Youth', 2, ARRAY['Youth', '14-18', '13 & Under', 'L3 Youth', 'L2 Youth', 'L1 Youth', 'Rookie Youth', 'Walk-Trot Youth']);

    -- APHA Data
    CALL insert_division_data(apha_id, 'Open', 0, ARRAY['Open', 'Junior', 'Senior', 'Green']);
    CALL insert_division_data(apha_id, 'Amateur', 1, ARRAY['Amateur', 'Masters Amateur (45+)', 'Novice Amateur', 'Amateur Walk-Trot']);
    CALL insert_division_data(apha_id, 'Youth', 2, ARRAY['Youth 18 & Under', 'Youth 13 & Under', 'Novice Youth', 'Youth Walk-Trot (11-18)', 'Youth Walk-Trot (5-10)']);

    -- ApHC Data
    CALL insert_division_data(aphc_id, 'Open', 0, ARRAY['Open', 'Green', 'Junior', 'Senior', 'Green Western Riding']);
    CALL insert_division_data(aphc_id, 'Non-Pro', 1, ARRAY['Non-Pro', 'Novice Non-Pro', '35 & Over Non-Pro', 'Masters Non-Pro (50+)']);
    CALL insert_division_data(aphc_id, 'Youth', 2, ARRAY['Youth 13 & Under', 'Youth 14-18', 'Novice Youth', 'Walk-Trot 10 & Under', 'Walk-Trot 11-18']);

    -- NSBA Data
    CALL insert_division_data(nsba_id, 'Open', 0, ARRAY['Open', 'Intermediate Open', 'Limited Open', 'Green', 'Junior', 'Senior']);
    CALL insert_division_data(nsba_id, 'Non-Pro', 1, ARRAY['Non-Pro', 'Intermediate Non-Pro', 'Limited Non-Pro', 'Novice Non-Pro', 'Masters Non-Pro (50+)']);
    CALL insert_division_data(nsba_id, 'Youth', 2, ARRAY['Youth 13 & Under', 'Youth 14-18', 'Novice Youth']);
    CALL insert_division_data(nsba_id, 'Walk-Trot', 3, ARRAY['Youth Walk-Trot 5-10', 'Youth Walk-Trot 11-18', 'Amateur Walk-Trot']);
    CALL insert_division_data(nsba_id, 'Color', 4, ARRAY['Color Open', 'Color Non-Pro', 'Color Youth']);
    CALL insert_division_data(nsba_id, 'EWD', 5, ARRAY['EWD Showmanship (Independent/Supported)', 'EWD Horsemanship']);

    -- PHBA Data
    CALL insert_division_data(phba_id, 'Open', 0, ARRAY['Open']);
    CALL insert_division_data(phba_id, 'Amateur', 1, ARRAY['Amateur', 'Novice Amateur', 'Amateur Walk-Trot']);
    CALL insert_division_data(phba_id, 'Youth', 2, ARRAY['Youth 14–18', 'Youth 13 & Under', 'Youth Walk-Trot (10–18)', 'Youth Walk-Trot (5–9)']);

    -- PtHA Data
    CALL insert_division_data(ptha_id, 'Open', 0, ARRAY['Open']);
    CALL insert_division_data(ptha_id, 'Amateur', 1, ARRAY['Amateur', 'Amateur Novice', 'Amateur Walk-Trot', 'Amateur Junior (19-39)', 'Amateur Senior (40-54)', 'Amateur Elite (55+)']);
    CALL insert_division_data(ptha_id, 'Youth', 2, ARRAY['Youth', 'Youth Novice', 'Youth Walk-Trot', 'Youth Walk-Trot 10 & Under', 'Youth Walk-Trot 11-18']);
    CALL insert_division_data(ptha_id, 'Type', 3, ARRAY['Stock Type', 'Hunter Type', 'Pleasure Type', 'Saddle Type', 'Miniature', 'Pony']);

    -- ABRA Data
    CALL insert_division_data(abra_id, 'Open', 0, ARRAY['Open']);
    CALL insert_division_data(abra_id, 'Amateur', 1, ARRAY['Amateur', 'Novice Amateur']);
    CALL insert_division_data(abra_id, 'Youth', 2, ARRAY['Youth', 'Novice Youth', 'Walk-Trot', 'Youth Walk-Trot']);

    -- USEF Data
    CALL insert_division_data(usef_id, 'Open', 0, ARRAY['Professional/Open']);
    CALL insert_division_data(usef_id, 'Amateur', 1, ARRAY['Amateur', 'Amateur Owner (3’3”, 3’6”)', 'Adult Amateur Hunter', 'Adult Jumper', 'Low/High Amateur Owner Jumper']);
    CALL insert_division_data(usef_id, 'Youth', 2, ARRAY['Junior (≤17)', 'Junior Hunter (3’3”, 3’6”)', 'Children’s Hunter', 'Low Children''s Hunter', 'Pony Hunter (Small/Medium/Large)', 'Children''s Jumper', 'Low/High Junior Jumper', 'Youth Walk-Trot']);

    -- USHJA Data
    CALL insert_division_data(ushja_id, 'Amateur', 0, ARRAY['Amateur Owner 3’3”/3’6”', 'Adult Amateur']);
    CALL insert_division_data(ushja_id, 'Youth', 1, ARRAY['Junior 3’3”/3’6”', 'Children’s', 'Low Children''s', 'Pony (S/M/L)', 'USHJA Hunter 2’0”–3’0”', 'Youth Walk-Trot']);

    -- AHA Data
    CALL insert_division_data(aha_id, 'Open', 0, ARRAY['Open']);
    CALL insert_division_data(aha_id, 'Amateur', 1, ARRAY['ATR/AATR (Amateur)', 'AOTR/AAOTR (Amateur Owner)']);
    CALL insert_division_data(aha_id, 'Youth', 2, ARRAY['JTR/JOTR (Junior)', 'Walk-Trot/Jog 10 & Under', '11+ W/T/J', 'Youth Walk-Trot']);

    -- ISHA Data
    CALL insert_division_data(isha_id, 'Hunt Seat', 0, ARRAY['Open Fences/Flat', 'Intermediate Fences/Flat', 'Limit Fences/Flat', 'Novice Flat', 'Pre-Novice Flat', 'Introductory Flat']);
    CALL insert_division_data(isha_id, 'Western', 1, ARRAY['Open Horsemanship/Reining', 'Level II Horsemanship/Reining', 'Level I Horsemanship', 'Rookie Horsemanship', 'Beginner Horsemanship']);

    -- 4-H Data
    CALL insert_division_data(four_h_id, 'Age Group', 0, ARRAY['Junior (9-13)', 'Senior (14-18)']);
    CALL insert_division_data(four_h_id, 'Experience', 1, ARRAY['Novice Rider', 'Experienced Rider']);

    -- NCEA Data
    CALL insert_division_data(ncea_id, 'Discipline', 0, ARRAY['Fences', 'Flat', 'Horsemanship', 'Reining']);

    -- Versatility Ranch Horse Data
    CALL insert_division_data(vrh_id, 'Open', 0, ARRAY['Open', 'Limited Open', 'Rookie']);
    CALL insert_division_data(vrh_id, 'Cowboy', 1, ARRAY['Cowboy']);
    CALL insert_division_data(vrh_id, 'Amateur', 2, ARRAY['Amateur', 'Limited Amateur', 'Rookie Amateur']);
    CALL insert_division_data(vrh_id, 'Youth', 3, ARRAY['Youth', 'Limited Youth', 'Rookie Youth']);

    -- Open Show Data
    CALL insert_division_data(open_show_id, 'Open', 0, ARRAY['Open All Ages']);
    CALL insert_division_data(open_show_id, 'Amateur', 1, ARRAY['Adult 19 & Over', 'Novice Adult', 'Adult Walk-Trot']);
    CALL insert_division_data(open_show_id, 'Youth', 2, ARRAY['Youth 18 & Under', 'Youth 13 & Under', 'Novice Youth', 'Youth Walk-Trot 11-18', 'Youth Walk-Trot 10 & Under']);

END $$;