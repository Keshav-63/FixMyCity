-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update upvote_count on complaints when upvotes change
CREATE OR REPLACE FUNCTION public.update_upvote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE complaints SET upvote_count = upvote_count + 1 WHERE id = NEW.complaint_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE complaints SET upvote_count = upvote_count - 1 WHERE id = OLD.complaint_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_upvote_change ON upvotes;

CREATE TRIGGER on_upvote_change
  AFTER INSERT OR DELETE ON upvotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_upvote_count();

-- Update updated_at timestamp on complaint changes
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_complaint_update ON complaints;

CREATE TRIGGER on_complaint_update
  BEFORE UPDATE ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
