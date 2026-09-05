import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://klteevegsvzqhtvdgsbr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gIb9RPDROEUZ0yHhOs-KrQ_LYPUJcmI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('answers').insert({ 
    student_exam_id: '21070dba-812f-4847-b34c-660efdd56b60',
    question_id: '00284b50-4b3a-8c9d-a123-00000a7bcd10', // I need a valid question id to test
    option_id: null,
    score: 100
  });
  console.log("Error:", error);
}
test();
