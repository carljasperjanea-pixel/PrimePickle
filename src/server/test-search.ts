
import { supabase } from './supabase';

async function testSearch() {
  const q = 'a'; // Search for 'a'
  console.log(`Searching for "${q}"...`);

  try {
    const { data: players, error } = await supabase
      .from('profiles')
      .select('id, display_name, non_existent_column') // This should fail
      .ilike('display_name', `%${q}%`)
      .limit(20);

    if (error) {
      console.error('Search Error:', error);
    } else {
      console.log('Search Results:', players);
    }
  } catch (e) {
    console.error('Exception:', e);
  }
}

testSearch();
