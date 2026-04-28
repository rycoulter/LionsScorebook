import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");
const supabaseStorageJs = readFileSync(join(rootDir, "supabase-storage.js"), "utf8");
const supabaseSchemaSql = readFileSync(join(rootDir, "supabase-schema.sql"), "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = ["\nfunction ", "\n  function "]
    .map((needle) => source.indexOf(needle, start + 1))
    .filter((index) => index !== -1)
    .sort((a, b) => a - b)[0];
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const publicViews = appJs.match(/const PUBLIC_TAB_VIEWS = new Set\(\[[^\]]+\]\);/)?.[0] || "";
const publicReadViews = appJs.match(/const PUBLIC_READ_VIEWS = new Set\(\[[^\]]+\]\);/)?.[0] || "";
const adminViews = appJs.match(/const ADMIN_TAB_VIEWS = new Set\(\[[^\]]+\]\);/)?.[0] || "";

mustMatch(publicViews, /"news"/, "Team News should be visible in public tab navigation");
mustMatch(publicReadViews, /"news"/, "Team News should be public-readable");
mustMatch(adminViews, /"news"/, "Team News should remain available in admin mode");
mustMatch(adminViews, /"newsEditor"/, "News Editor should be an admin-only tab");
assert.doesNotMatch(publicViews, /"newsEditor"/, "News Editor should not be public navigation");
assert.doesNotMatch(publicReadViews, /"newsEditor"/, "News Editor should not be public-readable");
mustMatch(indexHtml, /data-view="news"[\s\S]*Team News/, "Top navigation should include Team News");
mustMatch(indexHtml, /data-view="newsEditor" hidden>News Editor<\/button>/, "Top navigation should include a hidden admin News Editor tab");
mustMatch(indexHtml, /id="homeTeamNewsLink"[\s\S]*View All News/, "Home card should include a View All News link");
mustMatch(indexHtml, /id="homeTeamNewsBody"/, "Home should render Team News items instead of the recent games body");
mustMatch(indexHtml, /id="newsView"[\s\S]*data-panel="news"/, "Team News page should be present");
mustMatch(indexHtml, /id="newsFeaturedStory"/, "Team News page should include a featured story area");
mustMatch(indexHtml, /id="newsCategoryFilters"[\s\S]*Game Recap[\s\S]*Player News[\s\S]*Team News/, "Team News page should include category filters");
mustMatch(indexHtml, /id="newsArticleList"/, "Team News page should include a full article list");
mustMatch(indexHtml, /id="newsEditorView"[\s\S]*data-panel="newsEditor"/, "Admin News Editor page should be present");
mustMatch(indexHtml, /id="newsEditorTitleInput"[\s\S]*id="newsEditorSummaryInput"[\s\S]*id="newsEditorBodyInput"/, "News Editor should collect title, summary, and rich body");
mustMatch(indexHtml, /id="newsEditorImageInput"[\s\S]*type="file"[\s\S]*accept="image\/\*"/, "News Editor should include an image upload field");
mustMatch(indexHtml, /id="newsEditorImagePreview"/, "News Editor should include an image preview");
mustMatch(indexHtml, /id="newsEditorCategory"/, "News Editor should select a category");
mustMatch(indexHtml, /id="newsEditorGameSelect"/, "News Editor should optionally link a game");
mustMatch(indexHtml, /id="newsGenerateFromGameBtn"[\s\S]*Generate from Game/, "News Editor should include Generate from Game");

const renderHomeBody = functionBody(appJs, "renderHome");
mustMatch(renderHomeBody, /homeTeamNewsBody[\s\S]*renderHomeTeamNewsCard\(teamNewsArticles\(\)\.slice\(0, 4\)\)/, "Home should render 3-4 recent news items");
assert.doesNotMatch(renderHomeBody, /homeRecentGamesBody[\s\S]*renderHomeRecentGamesList/, "Home should no longer render the Recent Games list in that slot");

mustMatch(functionBody(appJs, "bindEvents"), /homeTeamNewsLink[\s\S]*switchView\("news"\)/, "View All News should open the Team News page");
mustMatch(functionBody(appJs, "bindEvents"), /homeTeamNewsBody[\s\S]*selectedNewsArticleId = button\.dataset\.homeNewsId/, "Home news clicks should select that article for the News page");
mustMatch(functionBody(appJs, "bindEvents"), /newsArticleList[\s\S]*data-news-read[\s\S]*selectedNewsArticleId = button\.dataset\.newsRead[\s\S]*scrollIntoView/, "All Articles Read More should pull the full article into view");
mustMatch(functionBody(appJs, "teamNewsArticles"), /normalizeNewsArticles\(state\.newsArticles/, "Team News should render manual articles from app state");
assert.doesNotMatch(functionBody(appJs, "teamNewsArticles"), /completedGames\(Infinity\)|fallbackTeamNewsArticles|category: "Game Recap"/, "Team News should not auto-generate public articles");
mustMatch(functionBody(appJs, "renderTeamNews"), /articles\.find\(\(article\) => article\.id === selectedNewsArticleId\)[\s\S]*renderFeaturedNewsStory\(featured\)[\s\S]*renderNewsArticleCard\(article, article\.id === selectedNewsArticleId\)/, "Team News should render the selected full article and compact article list");
mustMatch(functionBody(appJs, "renderNewsArticleCard"), /news-article-thumb[\s\S]*<h3>\$\{escapeHtml\(article\.title\)\}<\/h3>[\s\S]*<p>\$\{escapeHtml\(article\.summary\)\}<\/p>[\s\S]*data-news-read/, "All Articles cards should show thumbnail, title, summary, and Read More");
assert.doesNotMatch(functionBody(appJs, "renderNewsArticleCard"), /news-article-body|news-category-pill/, "All Articles cards should not render full body content or category clutter");
mustMatch(functionBody(appJs, "newsArticleDraftFromGame"), /category: "Game Recap"/, "Generate from Game should produce editable recap copy");
mustMatch(functionBody(appJs, "newsArticleDraftFromGame"), /category: "Game Preview"/, "Generate from Game should produce editable preview copy");
mustMatch(functionBody(appJs, "generateNewsFromSelectedGame"), /newsArticleDraftFromGame\(game\)/, "Generate from Game should prefill the editor");
mustMatch(functionBody(appJs, "saveNewsArticle"), /normalizeNewsArticle[\s\S]*persistNewsArticles\("news-save", \{ article \}\)/, "News Editor should save normalized manual articles");
mustMatch(functionBody(appJs, "deleteNewsArticle"), /persistNewsArticles\("news-delete", \{ deleteArticleId: article\.id \}\)/, "News Editor should delete one article row at a time");
mustMatch(functionBody(appJs, "handleNewsImageUpload"), /resizeNewsImageFile\(file\)/, "News Editor should preview uploaded images through the safe helper");
mustMatch(functionBody(appJs, "sanitizeNewsBodyHtml"), /allowedTags[\s\S]*script, style, iframe, object, embed/, "Rich text body should be sanitized before display/save");
mustMatch(functionBody(appJs, "renderTeamNews"), /newsCategoryFilter/, "Team News page should honor category filtering");
mustMatch(functionBody(appJs, "hasMeaningfulSupabaseSnapshot"), /Array\.isArray\(snapshot\.newsArticles\) && snapshot\.newsArticles\.length/, "Supabase snapshot detection should include news article table rows");
mustMatch(appJs, /data\.newsArticlesMissingTable \? undefined : data\.newsArticles/, "Refresh should merge news table rows when the table is available");
mustMatch(functionBody(appJs, "syncSharedNewsArticle"), /supabaseStorage\.upsertNewsArticle\(article\)/, "Saving news should upsert the dedicated news_articles row");
mustMatch(functionBody(appJs, "deleteSharedNewsArticle"), /supabaseStorage\.deleteNewsArticle\(articleId\)/, "Deleting news should delete the dedicated news_articles row");
assert.doesNotMatch(functionBody(appJs, "persistNewsArticles"), /syncSharedSnapshot/, "News edits should not sync the full app_state snapshot");

mustMatch(stylesCss, /\.team-news-layout[\s\S]*grid-template-columns: minmax\(280px, 0\.92fr\) minmax\(0, 1\.08fr\)/, "Team News page should use a two-column desktop layout");
mustMatch(stylesCss, /\.home-team-news-item[\s\S]*grid-template-columns: 58px minmax\(0, 1fr\) 18px/, "Home news items should include thumbnail/title layout");
mustMatch(stylesCss, /\.news-article-card\.is-active[\s\S]*border-color: rgba\(245, 189, 33, 0\.42\)/, "Selected news list item should have an active state");
mustMatch(stylesCss, /\.news-article-card[\s\S]*grid-template-columns: 88px minmax\(0, 1fr\)/, "Compact news cards should keep thumbnails in the All Articles list");
mustMatch(stylesCss, /\.news-article-card-footer[\s\S]*justify-content: space-between/, "Compact news cards should align date and Read More cleanly");
mustMatch(stylesCss, /\.news-editor-layout[\s\S]*grid-template-columns: minmax\(320px, 0\.9fr\) minmax\(0, 1\.1fr\)/, "News Editor should keep a simple two-column desktop layout");
mustMatch(supabaseStorageJs, /function newsArticleFromRow/, "Supabase storage should map news_articles rows into app articles");
mustMatch(supabaseStorageJs, /function buildNewsArticleRow/, "Supabase storage should map app articles into news_articles rows");
mustMatch(supabaseStorageJs, /function fetchNewsArticles/, "Supabase storage should fetch news_articles");
mustMatch(supabaseStorageJs, /\.from\("news_articles"\)/, "Supabase storage should target news_articles");
mustMatch(supabaseStorageJs, /function upsertNewsArticle/, "Supabase storage should upsert one news article");
mustMatch(supabaseStorageJs, /function deleteNewsArticle/, "Supabase storage should delete one news article");
mustMatch(functionBody(supabaseStorageJs, "fetchBootstrap"), /newsArticles: newsArticlesResponse\.data \|\| \[\]/, "Bootstrap should include news table rows");
mustMatch(functionBody(supabaseStorageJs, "mergeRemoteSnapshot"), /newsRows = undefined[\s\S]*newsRows\.map\(newsArticleFromRow\)/, "Remote merge should prefer dedicated news table rows");
assert.doesNotMatch(functionBody(supabaseStorageJs, "buildAppStateRow"), /news_articles/, "App-state sync should not write manual news articles into metadata");
mustMatch(supabaseSchemaSql, /create table if not exists public\.news_articles/i, "Schema should create news_articles");
mustMatch(supabaseSchemaSql, /jsonb_array_elements\([\s\S]*app_state\.metadata -> 'news_articles'[\s\S]*'\[\]'::jsonb[\s\S]*\)/i, "Schema should safely migrate old app_state metadata articles into news_articles");
mustMatch(supabaseSchemaSql, /Public read news_articles/i, "news_articles should have public read RLS");
mustMatch(supabaseSchemaSql, /Authenticated write news_articles[\s\S]*public\.app_admins/i, "news_articles writes should be restricted to app admins");

console.log("Team News page checks passed.");
