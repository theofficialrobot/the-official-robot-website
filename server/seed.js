const path = require('path');
const { db, buildSearchText } = require('./db');

function loadCatalog() {
  const catalog = require(path.join(__dirname, '..', 'data', 'robots.js'));
  if (!catalog || !catalog.ROBOTS) throw new Error('data/robots.js did not export ROBOTS');
  return catalog.ROBOTS;
}

function seed() {
  const catalog = loadCatalog();
  const count = db.prepare('SELECT COUNT(*) AS n FROM robots WHERE source = ?').get('catalog').n;
  if (count > 0) {
    const upd = db.prepare('UPDATE robots SET image = ?, name = ?, maker = ?, type = ?, year = ?, price = ?, catalog_id = ? WHERE id = ? AND source = ? AND IFNULL(mfr_edited, 0) = 0');
    const tx = db.transaction((robots) => {
      let n = 0;
      for (const robot of Object.values(robots)) {
        if (!robot || !robot.id) continue;
        const info = upd.run(
          robot.image || null,
          robot.name,
          robot.maker || '',
          robot.type || 'humanoid',
          robot.releaseYear || null,
          Number(robot.basePrice) || 0,
          String(robot.id),
          String(robot.id),
          'catalog'
        );
        n += info.changes;
      }
      return n;
    });
    const n = tx(catalog);
    console.log('Refreshed ' + n + ' catalog rows from data/robots.js.');
    return count;
  }
  const insert = db.prepare(`
    INSERT OR REPLACE INTO robots (
      id, seller_id, catalog_id, name, maker, type, condition, year, price, image,
      short_desc, unique_summary, ideal_for, specs_intro, specs_json, highlights_json,
      variants_json, colors_json, website, icon, source, search_text
    ) VALUES (
      @id, NULL, @catalog_id, @name, @maker, @type, @condition, @year, @price, @image,
      @short_desc, @unique_summary, @ideal_for, @specs_intro, @specs_json, @highlights_json,
      @variants_json, @colors_json, @website, @icon, 'catalog', @search_text
    )
  `);

  const tx = db.transaction((robots) => {
    let n = 0;
    for (const robot of Object.values(robots)) {
      if (!robot || !robot.id || !robot.name) continue;
      const row = {
        id: String(robot.id),
        catalog_id: String(robot.id),
        name: robot.name,
        maker: robot.maker || '',
        type: robot.type || 'humanoid',
        condition: 'new',
        year: robot.releaseYear || null,
        price: Number(robot.basePrice) || 0,
        image: robot.image || null,
        short_desc: robot.shortDesc || '',
        unique_summary: robot.uniqueSummary || robot.shortDesc || '',
        ideal_for: robot.idealFor || '',
        specs_intro: robot.specsIntro || '',
        specs_json: JSON.stringify(robot.specs || {}),
        highlights_json: JSON.stringify(robot.highlights || []),
        variants_json: JSON.stringify(robot.variants || []),
        colors_json: JSON.stringify(robot.colors || []),
        website: robot.website || '',
        icon: robot.icon || '🤖',
        search_text: buildSearchText({
          name: robot.name,
          maker: robot.maker,
          type: robot.type,
          condition: 'new',
          year: robot.releaseYear,
          short_desc: robot.shortDesc,
          unique_summary: robot.uniqueSummary,
          specs: robot.specs
        })
      };
      insert.run(row);
      n += 1;
    }
    return n;
  });

  const inserted = tx(catalog);
  console.log('Seeded ' + inserted + ' catalog platforms from data/robots.js.');
  return inserted;
}

if (require.main === module) seed();

module.exports = { seed };
