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
  const columns = ["id","name","order","enabled"];
  const [settings,categories] = await Promise.all([
    read(587012752,["key","value"]), read(587012753,columns)
  ]);
  return {settings:settings ?? [{"key":"site_title","value":"Family Links"},{"key":"site_subtitle","value":"どのサイトに行こうか🎵"},{"key":"header_color","value":"#142B4C"},{"key":"header_text_color","value":"#FFFFFF"}],categories:categories ?? [{"id":"shopping","name":"買い物","order":"10","enabled":"true"},{"id":"video","name":"動画","order":"20","enabled":"true"},{"id":"blog","name":"ブログ","order":"30","enabled":"true"},{"id":"life","name":"生活","order":"40","enabled":"true"},{"id":"etc","name":"その他","order":"90","enabled":"true"},{"id":"convenience","name":"コンビニ","order":"45","enabled":"true"},{"id":"news","name":"ニュース","order":"50","enabled":"true"},{"id":"transport_travel","name":"交通・旅行","order":"60","enabled":"true"},{"id":"games","name":"ゲーム","order":"70","enabled":"true"},{"id":"food_delivery","name":"飲食・デリバリー","order":"80","enabled":"true"}]};
}
