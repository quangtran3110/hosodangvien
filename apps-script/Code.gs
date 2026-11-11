// Backend Google Apps Script. Cấu hình ID trong Script Properties, không chứa hồ sơ cá nhân trong mã.
const HSDV_VERSION = '2026.1';
const HSDV_YEAR = 2026;
const HSDV_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const HSDV_TIMESTAMP_FORMAT = 'dd/MM/yyyy HH:mm:ss';
const HSDV_SIGNING_DATE_PATTERN = 'Kiến Tường,\\s*ngày\\s*[.…0-9]*\\s*tháng\\s*[.…0-9]*\\s*năm\\s*[.…0-9]+';
const HSDV_HEADERS = ['Chọn xuất file','Thời gian gửi','Chi bộ','Họ và tên','Ngày sinh','Số lý lịch','Số thẻ đảng','Nơi ở','Đơn vị công tác mới','CV Đảng','CV Chính quyền','CV Đoàn thể','CV Doanh nghiệp','GD Phổ thông','Chuyên môn','Học vị','Học hàm','Lý luận CT','Ngoại ngữ','Khen thưởng','Kỷ luật','Chi tiết Gia đình','Tổng thu nhập','Bình quân/người','Nhà ở mới','Đất ở mới','HĐ Kinh tế','Tài sản mới','LINK','Mã gửi'];

function hsdvConfig_() {
  const props = PropertiesService.getScriptProperties();
  const config = {spreadsheetId:props.getProperty('HSDV_SPREADSHEET_ID'),templateId:props.getProperty('HSDV_TEMPLATE_ID'),folderId:props.getProperty('HSDV_FOLDER_ID'),template2026Id:props.getProperty('HSDV_TEMPLATE_2026_ID')};
  if(!config.spreadsheetId || !config.templateId || !config.folderId) throw new Error('Hệ thống chưa được cấu hình cho năm 2026.');
  return config;
}
function hsdvText_(value, max) {
  if(value === null || value === undefined) return '';
  if(typeof value !== 'string' && typeof value !== 'number') throw new Error('Thông tin kê khai chưa đúng định dạng.');
  const text = String(value).trim();
  if(text.length > (max || 1500)) throw new Error('Một nội dung kê khai quá dài. Vui lòng rút gọn.');
  return text;
}
function hsdvNormalize_(value) {return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim().replace(/\s+/g,' ');}
function hsdvDate_(value) {
  let text = hsdvText_(value, 20), match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if(!match) throw new Error('Ngày sinh phải theo định dạng dd/mm/yyyy.');
  const d=Number(match[1]),m=Number(match[2]),y=Number(match[3]),date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d || y<1900 || date.getTime()>Date.now()) throw new Error('Ngày sinh chưa hợp lệ.');
  return String(d).padStart(2,'0')+'/'+String(m).padStart(2,'0')+'/'+y;
}
function hsdvMoney_(value) {
  const text=hsdvText_(value,25);
  if(!/^(?:\d+|\d{1,3}(?:[., ]\d{3})+)$/.test(text)) throw new Error('Tổng thu nhập phải là số tiền đồng, ví dụ 120.000.000.');
  const num=Number(text.replace(/[., ]/g,''));
  if(!Number.isSafeInteger(num) || num<0) throw new Error('Tổng thu nhập chưa hợp lệ.');
  return num;
}
function hsdvCell_(value) {return typeof value==='string' && /^[=+@-]/.test(value) ? "'"+value : value;}
function hsdvOutput_(data,callback) {
  const json=JSON.stringify(Object.assign({apiVersion:HSDV_VERSION},data));
  if(callback && /^hsdv_[a-z0-9_]{8,100}$/.test(callback)) return ContentService.createTextOutput(callback+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
function hsdvColumn_(sheet,col,last) {return last>1?sheet.getRange(2,col,last-1,1).getDisplayValues().map(row=>row[0]):[];}
function hsdvLegacy_(ss) {return ss.getSheetByName('2025') || ss.getSheetByName('Sheet1');}
function hsdvIdentity_(branch, name, birth, card) {
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(birth).trim());
  const date = parts ? [Number(parts[1]), Number(parts[2]), Number(parts[3])].join('/') : '';
  const branchKey = hsdvNormalize_(branch).replace(/^chi bo ([123])$/, (_, digit) => 'chi bo ' + ['mot', 'hai', 'ba'][digit - 1]);
  const cardText = String(card).trim().replace(/^'/, '');
  return {branch:branchKey, name:hsdvNormalize_(name), birth:date, card:/^\d{11,12}$/.test(cardText) ? cardText.padStart(12, '0') : ''};
}
function hsdvDossierSource_(ss) {
  const sheet = hsdvLegacy_(ss);
  if(!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 3, sheet.getLastRow() - 1, 5).getDisplayValues().flatMap(([branch,name,birth,number,card]) => {
    const dossier = String(number).trim().replace(/^'/, '');
    return /\d/.test(dossier) ? [{identity:hsdvIdentity_(branch,name,birth,card), dossier}] : [];
  });
}
function hsdvDossierNumber_(source, identity) {
  const byCard = source.filter(({identity:old}) => identity.card && old.card === identity.card && (old.name === identity.name || (identity.birth && old.birth === identity.birth)));
  const matches = byCard.length ? byCard : source.filter(({identity:old}) => identity.name && identity.birth && old.branch === identity.branch && old.name === identity.name && old.birth === identity.birth);
  const numbers = [...new Set(matches.map(row => row.dossier))];
  return numbers.length === 1 ? numbers[0] : '';
}
function hsdvDirectory_() {
  const cache=CacheService.getScriptCache(),key='hsdv_directory_2026_v2',saved=cache.get(key);
  if(saved) return JSON.parse(saved);
  const config=hsdvConfig_();
  let members;try{members=JSON.parse(PropertiesService.getScriptProperties().getProperty('HSDV_MEMBERS_2026')||'[]');}catch(error){throw new Error('Danh sách thành viên năm 2026 chưa đúng định dạng.');}
  if(!Array.isArray(members))throw new Error('Danh sách thành viên năm 2026 chưa đúng định dạng.');
  const ss=SpreadsheetApp.openById(config.spreadsheetId),legacy=hsdvLegacy_(ss),addressByCard={},addressByName={};
  if(legacy){
    const end=legacy.getLastRow(),oldNames=hsdvColumn_(legacy,4,end),oldCards=hsdvColumn_(legacy,7,end),oldAddresses=hsdvColumn_(legacy,8,end),oldBranches=hsdvColumn_(legacy,3,end);
    oldNames.forEach((name,i)=>{
      if(!['chi bo mot','chi bo 1'].includes(hsdvNormalize_(oldBranches[i])))return;
      const address=String(oldAddresses[i]||'').trim();if(!address||address==='K')return;
      const card=String(oldCards[i]||'').replace(/^'/,'').trim();if(card)addressByCard[card]=address;
      addressByName[hsdvNormalize_(name)]=address;
    });
  }
  const directory=[];
  members.forEach(member=>{
    if(!member || !['chi bo mot','chi bo 1'].includes(hsdvNormalize_(member.chiBo||'CHI BỘ MỘT')))return;
    const name=hsdvText_(member.hoTen,120);if(!name)return;
    const card=hsdvText_(member.soThe,20),soThe=/^\d{12}$/.test(card)?card:'';
    directory.push({id:hsdvNormalize_(name).replace(/ /g,'-'),hoTen:name.toUpperCase(),ngaySinh:hsdvDate_(member.ngaySinh),soThe,noiO:addressByCard[soThe]||addressByName[hsdvNormalize_(name)]||''});
  });
  if(!directory.length) throw new Error('Chưa tìm thấy thành viên Chi bộ Một trong danh sách.');
  if(new Set(directory.map(member=>member.id)).size!==directory.length)throw new Error('Danh sách thành viên có tên trùng. Vui lòng liên hệ người quản lý.');
  directory.sort((a,b)=>a.hoTen.localeCompare(b.hoTen,'vi'));
  cache.put(key,JSON.stringify(directory),300);
  return directory;
}
function hsdvReceipt_(requestId, sheet) {
  if(!/^[a-zA-Z0-9-]{12,80}$/.test(requestId||'')) throw new Error('Mã gửi chưa hợp lệ.');
  const target = sheet || SpreadsheetApp.openById(hsdvConfig_().spreadsheetId).getSheetByName('2026');
  return Boolean(target && target.getLastRow() > 1 && target.getRange(2,30,target.getLastRow()-1,1).createTextFinder(requestId).matchEntireCell(true).useRegularExpression(false).findNext());
}
function doGet(e) {
  const p=(e&&e.parameter)||{};
  try{
    if(p.callback && !/^hsdv_[a-z0-9_]{8,100}$/.test(p.callback)) throw new Error('Yêu cầu chưa hợp lệ.');
    if(!p.action || p.action==='health') return hsdvOutput_({result:'success',year:HSDV_YEAR,submissionDate:true},p.callback);
    if(p.action==='members') return hsdvOutput_({result:'success',members:hsdvDirectory_().map(m=>({id:m.id,hoTen:m.hoTen}))},p.callback);
    if(p.action==='profile'){
      const member=hsdvDirectory_().find(m=>m.id===p.id);if(!member)throw new Error('Không tìm thấy thành viên. Đồng chí có thể nhập trực tiếp.');
      return hsdvOutput_({result:'success',profile:{ngaySinh:member.ngaySinh,soThe:member.soThe,noiO:member.noiO}},p.callback);
    }
    if(p.action==='receipt') return hsdvOutput_({result:'success',saved:hsdvReceipt_(p.requestId),year:HSDV_YEAR},p.callback);
    throw new Error('Yêu cầu chưa được hỗ trợ.');
  }catch(error){return hsdvOutput_({result:'error',message:error.message},p.callback);}
}
function hsdvSheet2026_(ss) {
  let sheet=ss.getSheetByName('2026');
  if(!sheet) sheet=ss.insertSheet('2026');
  if(sheet.getMaxColumns()<30)sheet.insertColumnsAfter(sheet.getMaxColumns(),30-sheet.getMaxColumns());
  if(sheet.getLastRow()===0){
    sheet.getRange(1,1,1,30).setValues([HSDV_HEADERS]);sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,30).setFontWeight('bold').setBackground('#f5e8eb').setWrap(true);
    sheet.getRange('E:G').setNumberFormat('@');sheet.getRange('W:X').setNumberFormat('#,##0');sheet.getRange('B:B').setNumberFormat(HSDV_TIMESTAMP_FORMAT);
    sheet.setColumnWidth(1,70);sheet.setColumnWidth(4,220);sheet.setColumnWidth(8,330);sheet.setColumnWidth(29,280);sheet.setColumnWidth(30,270);
  }else{
    const headers=sheet.getRange(1,1,1,30).getDisplayValues()[0];
    if(hsdvNormalize_(headers[3])!=='ho va ten' || hsdvNormalize_(headers[6]).indexOf('so the')!==0) throw new Error('Trang tính 2026 có cấu trúc khác. Vui lòng liên hệ người quản lý.');
    if(!headers[29])sheet.getRange(1,30).setValue('Mã gửi');
  }
  return sheet;
}
function hsdvRecord_(data) {
  if(!data || data.apiVersion!==HSDV_VERSION || data.year!==HSDV_YEAR) throw new Error('Vui lòng tải lại trang để kê khai theo biểu mẫu năm 2026.');
  if(!/^[a-zA-Z0-9-]{12,80}$/.test(data.requestId||'')) throw new Error('Thiếu mã gửi. Vui lòng thử lại từ biểu mẫu.');
  const branch=hsdvText_(data.chiBo,50),name=hsdvText_(data.hoTen,120).toUpperCase(),birth=hsdvDate_(data.ngaySinh),card=hsdvText_(data.soThe,20),address=hsdvText_(data.noiO,1500);
  if(!['CHI BỘ MỘT','CHI BỘ HAI','CHI BỘ BA'].includes(branch)||!name||!address)throw new Error('Vui lòng điền đủ chi bộ, họ tên và nơi ở hiện tại.');
  if(!/^\d{12}$/.test(card) && !(data.chuaCoThe===true && card===''))throw new Error('Số thẻ đảng viên phải gồm 12 chữ số, hoặc chọn chưa được cấp thẻ.');
  const field=(check,key)=>data[check]===true?(hsdvText_(data[key])||'K'):'K';
  let family='K';
  if(data.checkFamily===true){
    const allowed=['Cha đẻ','Mẹ đẻ','Cha (vợ/chồng)','Mẹ (vợ/chồng)','Vợ/Chồng','Con'];
    if(data.familyRows!==undefined && !Array.isArray(data.familyRows))throw new Error('Nội dung gia đình chưa đúng định dạng.');
    const rows=(data.familyRows||[]);if(rows.length>20)throw new Error('Có quá nhiều nội dung gia đình.');
    const values=rows.map(item=>{if(!item || !allowed.includes(item.quanHe))throw new Error('Quan hệ gia đình chưa hợp lệ.');return {quanHe:item.quanHe,noiDung:hsdvText_(item.noiDung,3000)};}).filter(row=>row.noiDung);
    if(values.length)family=JSON.stringify(values);
  }
  let income='K',average='K';
  if(data.checkKinhTe===true && hsdvText_(data.thuNhap,25)!==''){
    income=hsdvMoney_(data.thuNhap);const people=Number(data.soNguoi);
    if(!/^\d+$/.test(String(data.soNguoi||'')) || !Number.isInteger(people) || people<1 || people>100)throw new Error('Vui lòng nhập số người trong hộ từ 1 đến 100.');
    average=Math.round(income/people);
  }
  return [false,new Date(),branch,name,birth,'',card,address,field('checkCongTac','congTac'),field('checkChucVu','cvDang'),field('checkChucVu','cvChinhQuyen'),field('checkChucVu','cvDoanThe'),field('checkChucVu','cvDoanhNghiep'),field('checkTrinhDo','gdPhoThong'),field('checkTrinhDo','chuyenMon'),field('checkTrinhDo','hocVi'),field('checkTrinhDo','hocHam'),field('checkTrinhDo','lyLuan'),field('checkTrinhDo','ngoaiNgu'),field('checkKhenThuong','khenThuong'),field('checkKhenThuong','kyLuat'),family,income,average,field('checkKinhTe','nhaO'),field('checkKinhTe','datO'),field('checkKinhTe','hdKinhTe'),field('checkKinhTe','taiSan'),'',data.requestId].map(hsdvCell_);
}
function doPost(e) {
  const lock=LockService.getScriptLock();let locked=false;
  try{
    const contents=e&&e.postData&&e.postData.contents;
    if(typeof contents!=='string' || contents.length>40000)throw new Error('Nội dung gửi chưa hợp lệ.');
    let data;try{data=JSON.parse(contents);}catch(error){throw new Error('Nội dung gửi chưa đúng định dạng.');}
    const record=hsdvRecord_(data);
    locked=lock.tryLock(10000);if(!locked)throw new Error('Hệ thống đang nhận phiếu khác. Đồng chí vui lòng thử lại sau ít giây.');
    const ss=SpreadsheetApp.openById(hsdvConfig_().spreadsheetId),sheet=hsdvSheet2026_(ss);
    if(hsdvReceipt_(data.requestId,sheet))return hsdvOutput_({result:'success',year:HSDV_YEAR,requestId:data.requestId,duplicate:true});
    const identity = hsdvIdentity_(record[2],record[3],record[4],record[6]);
    record[5] = hsdvCell_(hsdvDossierNumber_(hsdvDossierSource_(ss), identity));
    const row=sheet.getLastRow()+1;
    sheet.getRange(row,5,1,3).setNumberFormat('@');sheet.getRange(row,1,1,30).setValues([record]);sheet.getRange(row,1).insertCheckboxes();
    SpreadsheetApp.flush();
    return hsdvOutput_({result:'success',year:HSDV_YEAR,requestId:data.requestId});
  }catch(error){return hsdvOutput_({result:'error',message:error.message});}
  finally{if(locked)lock.releaseLock();}
}
function repairHsdv2026() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(hsdvConfig_().spreadsheetId);
    const sheet = hsdvSheet2026_(ss);
    const count = sheet.getLastRow() - 1;
    const timeZoneBefore = ss.getSpreadsheetTimeZone();
    // Keep the original instants if a run is interrupted between the timezone change and the rewrite.
    const checkpointKey = 'HSDV_TIMESTAMP_REPAIR_2026';
    let timestamps = JSON.parse(props.getProperty(checkpointKey) || 'null');
    if(timestamps === null && timeZoneBefore !== HSDV_TIME_ZONE) {
      timestamps = [];
      if(count > 0) {
        const range = sheet.getRange(2, 2, count, 1);
        const formulas = range.getFormulas();
        range.getValues().forEach(([date],i) => {
          if(date instanceof Date && !formulas[i][0]) timestamps.push([i + 2, date.getTime()]);
        });
      }
      props.setProperty(checkpointKey, JSON.stringify(timestamps));
    }
    if(timeZoneBefore !== HSDV_TIME_ZONE) ss.setSpreadsheetTimeZone(HSDV_TIME_ZONE);
    SpreadsheetApp.flush();
    for(const [row, millis] of timestamps || []) sheet.getRange(row, 2).setValue(new Date(millis));
    sheet.getRange('B:B').setNumberFormat(HSDV_TIMESTAMP_FORMAT);
    SpreadsheetApp.flush();
    for(const [row, millis] of timestamps || []) {
      const date = sheet.getRange(row, 2).getValue();
      if(!(date instanceof Date) || Math.abs(date.getTime() - millis) >= 1000) throw new Error('Chưa xác nhận được thời gian đã quy đổi ở dòng ' + row + '.');
    }
    if(timestamps !== null) props.deleteProperty(checkpointKey);
    const source = hsdvDossierSource_(ss);
    const rows = count > 0 ? sheet.getRange(2,3,count,5).getDisplayValues() : [];
    let filled = 0, missing = 0;
    rows.forEach(([branch,name,birth,number,card], i) => {
      if(!name || String(number).trim()) return;
      const match = hsdvDossierNumber_(source, hsdvIdentity_(branch,name,birth,card));
      if(!match) { missing++; return; }
      sheet.getRange(i + 2, 6).setNumberFormat('@').setValue(hsdvCell_(match));
      filled++;
    });
    SpreadsheetApp.flush();
    console.log(JSON.stringify({timeZoneBefore, timeZone:ss.getSpreadsheetTimeZone(), timestampsAdjusted:(timestamps || []).length, dossierNumbersFilled:filled, dossierNumbersMissing:missing}));
  } finally {
    lock.releaseLock();
  }
}
function setup2026() {
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const config=hsdvConfig_();CacheService.getScriptCache().remove('hsdv_directory_2026_v2');const members=hsdvDirectory_();
    const ss=SpreadsheetApp.openById(config.spreadsheetId);hsdvSheet2026_(ss);
    if(!config.template2026Id){
      const copy=DriveApp.getFileById(config.templateId).makeCopy('Mẫu 3-HSĐV 2026',DriveApp.getFolderById(config.folderId));
      const doc=DocumentApp.openById(copy.getId());doc.getBody().replaceText('Năm 2025','Năm {{NAM}}');doc.saveAndClose();
      PropertiesService.getScriptProperties().setProperty('HSDV_TEMPLATE_2026_ID',copy.getId());
    }
    SpreadsheetApp.flush();console.log(JSON.stringify({year:2026,members:members.length,sheet:'2026',ready:true}));
  }finally{lock.releaseLock();}
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚠️ QUẢN LÝ ĐẢNG VIÊN').addItem('Xuất file cho người ĐANG CHỌN (✔)','createDocsForSelected').addItem('Xuất file dòng cuối cùng','createDocFromLastRow').addSeparator().addItem('Làm mới danh sách Chi bộ Một','refreshMembers2026').addToUi();
}
function refreshMembers2026(){CacheService.getScriptCache().remove('hsdv_directory_2026_v2');const count=hsdvDirectory_().length;SpreadsheetApp.getUi().alert('Đã cập nhật '+count+' thành viên Chi bộ Một.');}
function hsdvExportSheet_(){const ss=SpreadsheetApp.getActiveSpreadsheet(),active=ss.getActiveSheet();if(active && ['2026','2025','Sheet1'].includes(active.getName()))return active;return ss.getSheetByName('2026')||hsdvLegacy_(ss);}
function createDocsForSelected() {
  const ws=hsdvExportSheet_(),ui=SpreadsheetApp.getUi();if(!ws || ws.getLastRow()<2){ui.alert('Chưa có dữ liệu!');return;}
  const rows=ws.getRange(2,1,ws.getLastRow()-1,28).getValues();let count=0;
  for(let i=0;i<rows.length;i++)if(rows[i][0]===true){processOneRow(ws.getRange(i+2,1,1,28).getDisplayValues()[0],i+2,ws);ws.getRange(i+2,1).setValue(false);count++;}
  ui.alert(count?'Đã xuất '+count+' phiếu của trang '+ws.getName()+'. Liên kết ở cột AC.':'Chưa chọn người nào ở cột A.');
}
function createDocFromLastRow(){const ws=hsdvExportSheet_();if(!ws || ws.getLastRow()<2){SpreadsheetApp.getUi().alert('Chưa có dữ liệu!');return;}const row=ws.getLastRow();processOneRow(ws.getRange(row,1,1,28).getDisplayValues()[0],row,ws);}
function processOneRow(data,rowIndex,ws) {
  if(rowIndex<2 || !String(data[3]||'').trim())throw new Error('Không có thông tin đảng viên để xuất phiếu.');
  const config=hsdvConfig_(),year=ws.getName()==='2026'?2026:2025,template=year===2026?config.template2026Id:config.templateId;
  if(!template)throw new Error('Chưa khởi tạo mẫu phiếu năm 2026.');
  const file=DriveApp.getFileById(template).makeCopy('HSĐV_'+data[3]+'_'+year,DriveApp.getFolderById(config.folderId)),doc=DocumentApp.openById(file.getId()),body=doc.getBody();
  if(year === HSDV_YEAR) {
    hsdvFillSigningDate_(body, ws.getRange(rowIndex, 2).getValue(), data[1]);
    hsdvFillSigningName_(body, data[3]);
  }
  const money=value=>{if(value===null || value===undefined || String(value).trim()==='')return 'K';if(String(value).trim()==='K')return 'K';try{return hsdvMoney_(value).toLocaleString('vi-VN');}catch(error){return String(value);}};
  const map={NAM:year,CHI_BO:data[2],HO_TEN:data[3],NGAY_SINH:data[4],SO_LL:data[5]||'.......',SO_THE:data[6]||'Chưa được cấp thẻ',NOI_O:data[7],CONG_TAC:data[8],CV_DANG:data[9],CV_CHINH_QUYEN:data[10],CV_DOAN_THE:data[11],CV_DOANH_NGHIEP:data[12],GD_PT:data[13],CHUYEN_MON:data[14],HOC_VI:data[15],HOC_HAM:data[16],LY_LUAN:data[17],NGOAI_NGU:data[18],KHEN_THUONG:data[19],KY_LUAT:data[20],THU_NHAP:money(data[22]),BINH_QUAN:money(data[23]),NHA_O:data[24],DAT_O:data[25],HD_KINH_TE:data[26],TAI_SAN:data[27]};
  const family={'Cha đẻ':'CHA_DE','Mẹ đẻ':'ME_DE','Cha (vợ/chồng)':'CHA_VO_CHONG','Mẹ (vợ/chồng)':'ME_VO_CHONG','Vợ/Chồng':'VO_CHONG','Con':'CON_CAI'};Object.values(family).forEach(key=>map[key]='K');
  if(data[21] && data[21]!=='K'){let values;try{values=JSON.parse(String(data[21]));}catch(error){throw new Error('Nội dung gia đình ở dòng '+rowIndex+' chưa đúng định dạng.');}if(!Array.isArray(values))throw new Error('Nội dung gia đình chưa hợp lệ.');values.forEach(item=>{const key=family[item.quanHe];if(key&&item.noiDung)map[key]=map[key]==='K'?String(item.noiDung):map[key]+'; '+item.noiDung;});}
  Object.keys(map).forEach(key=>{const pattern='\\{\\{'+key+'\\}\\}';body.replaceText(pattern,map[key]===undefined||map[key]===null?'K':String(map[key]));});
  doc.saveAndClose();ws.getRange(rowIndex,29).setValue(file.getUrl());
}
function hsdvFillSigningDate_(body, timestamp, displayValue) {
  const display = timestamp instanceof Date ? Utilities.formatDate(timestamp, HSDV_TIME_ZONE, 'dd/MM/yyyy') : String(displayValue || '').trim();
  const date = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(display);
  if(!date) return;
  const signingDate = 'Kiến Tường, ngày ' + date[1].padStart(2, '0') + ' tháng ' + date[2].padStart(2, '0') + ' năm ' + date[3];
  body.replaceText(HSDV_SIGNING_DATE_PATTERN, signingDate);
}
function hsdvFillSigningName_(body, name) {
  const marker = '{{HO_TEN}}';
  const pattern = '\\{\\{HO_TEN\\}\\}';
  const signingName = String(name).trim().normalize('NFC').toLocaleLowerCase('vi-VN')
    .replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('vi-VN'));
  let match = null;
  while((match = body.findText(pattern, match))) {
    const paragraph = match.getElement().getParent();
    // The signature marker occupies its own paragraph; the profile header uses the same marker inline.
    if(paragraph.getText().trim() !== marker) continue;
    paragraph.replaceText(pattern, signingName);
    break;
  }
}
