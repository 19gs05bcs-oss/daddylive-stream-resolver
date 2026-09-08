export function renderSchedulePage(data: any): string {
  let contentHtml = "";

  for (const [day, categories] of Object.entries(data || {})) {
    contentHtml += `<h2 class="day-title">${day}</h2>`;

    for (const [category, events] of Object.entries(categories as Record<string, any[]>)) {
      contentHtml += `
        <div class="card" style="margin-bottom: 16px;">
          <h3 class="section-title">${category}</h3>
          <div class="schedule-list">
      `;

      for (const ev of events) {
        const channelsHtml = (ev.channels || [])
          .map((ch: any) => {
            if (!ch.channel_id || ch.channel_id === "00") return "";
            return `<a href="/?ch=${ch.channel_id}" class="badge badge--active" style="text-decoration:none; margin: 2px;">${ch.channel_name} (${ch.channel_id})</a>`;
          })
          .join(" ");

        contentHtml += `
          <div class="schedule-item" style="padding: 10px 0; border-bottom: 1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
              <span style="font-weight:600; color:var(--text);">${ev.event}</span>
              <span class="badge__ms" style="font-size:0.85rem; background:var(--surface-2); padding:2px 8px; border-radius:4px;">${ev.time || ev.time_visible}</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:4px;">
              ${channelsHtml || '<span style="color:var(--muted); font-size:0.8rem;">Kanal listelenmedi</span>'}
            </div>
          </div>
        `;
      }

      contentHtml += `</div></div>`;
    }
  }

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Canlı Maç & Etkinlik Programı</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main class="app">
    <header class="top">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h1 class="top__title">📅 Maç & Etkinlik Programı</h1>
        <a href="/" class="badge" style="text-decoration:none;">Oynatıcıya Dön</a>
      </div>
      <p class="top__desc">İzlemek istediğiniz kanal butonuna tıklayarak doğrudan yayını başlatabilirsiniz.</p>
    </header>
    ${contentHtml}
  </main>
</body>
</html>`;
}
