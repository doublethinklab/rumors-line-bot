/**
 * Run periodically (every 2-3 days) to detect common narratives across scraped issues.
 * Usage: npm run analyze-topics
 */
import 'dotenv/config';
import Issue from 'src/database/models/issue';
import { analyzeCommonTopics } from 'src/lib/aiSummary';

async function main() {
  const issues = await Issue.findAll();

  const withContent = issues
    .filter((i) => i.inputType === 'link' && i.scrapedText && i.scrapeStatus === 'done')
    .map((i) => ({
      id: String(i._id),
      text: i.aiSummary ?? i.scrapedText ?? '',
      url: i.canonicalText,
    }));

  if (withContent.length === 0) {
    console.log('No scraped issues to analyze.');
    process.exit(0);
  }

  console.log(`Analyzing ${withContent.length} scraped issues…`);

  const report = await analyzeCommonTopics(withContent);

  if (!report) {
    console.error('Analysis failed or ANTHROPIC_API_KEY not set.');
    process.exit(1);
  }

  console.log('\n=== Topic Analysis Report ===\n');
  console.log(report);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
