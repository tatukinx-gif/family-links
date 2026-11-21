const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr8kOGVw-CGardfhp4woOesRiOHnbjSJIEBi_zDcurIu6WNa8YkDUuAmLU5COwdbqfquL1u9Rq9P4s/pub?gid=587012751&single=true&output=csv";
function parseCsv(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){cell+='"';i++}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){row.push(cell.trim());cell=""}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=""}else cell+=c}if(cell||row.length){row.push(cell.trim());rows.push(row)}const [headers=[],...body]=rows;return body.map(v=>Object.fromEntries(headers.map((h,i)=>[h,v[i]||""])))}

export async function fetchConfiguration() {
  async function read(gid, columns) {
    try {
      const url = new URL(CSV_URL);
      url.searchParams.set("gid", gid);
      const response = await fetch(url, {cache:"no-store", signal:AbortSignal.timeout(4000)});
      if (!response.ok) return null;
      const csv = await response.text();
      const header = csv.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "").replaceAll('"', "");
      if (!columns.every(c => header.split(",").includes(c))) return null;
      return parseCsv(csv);
    } catch { return null; }
  }
  const settings = await read(587012752, ["key", "value"]);
  return {settings: settings ?? [
    {key:"site_title",value:"Family Links"},
    {key:"site_subtitle",value:"どのサイトに行こうか🎵"},
    {key:"header_color",value:"#142B4C"},
    {key:"header_text_color",value:"#FFFFFF"}
  ]};
}
