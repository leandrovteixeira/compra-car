do $$
declare
    resulting_direction text;
begin

    update public.specs
       set value_direction = 'Positive'
     where code = 'CO_0043'
       and type = 'numeric';

    if not found then
        raise exception 'Spec CO_0043 was not found or is not numeric.';
    end if;

    select value_direction::text
      into resulting_direction
      from public.specs
     where code = 'CO_0043'
       and type = 'numeric';

    if resulting_direction is distinct from 'Positive' then
        raise exception
            'Expected CO_0043 value_direction to be Positive, found %.',
            resulting_direction;
    end if;

end
$$;