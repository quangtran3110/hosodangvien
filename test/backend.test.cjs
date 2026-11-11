const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function setup({lock=true,headersOnly=false}={}){
  const copies=[],replacements={},cache=new Map(),props={HSDV_SPREADSHEET_ID:'main',HSDV_TEMPLATE_ID:'old',HSDV_FOLDER_ID:'folder',HSDV_TEMPLATE_2026_ID:'new',HSDV_MEMBERS_2026:JSON.stringify([{hoTen:'TÊN MỚI GIẢ LẬP',ngaySinh:'01/01/1990',soThe:'000000000001'},{hoTen:'THÀNH VIÊN CHƯA CÓ THẺ',ngaySinh:'10/11/1999',soThe:''},{hoTen:'CHI BỘ KHÁC',ngaySinh:'01/01/1991',soThe:'000000000002',chiBo:'CHI BỘ HAI'}])};
  class Sheet{
    constructor(name,rows=[]){this.name=name;this.rows=rows;this.cols=30;}
    getName(){return this.name;}getLastRow(){return this.rows.length;}getLastColumn(){return Math.max(1,...this.rows.map(row=>row.length));}getMaxColumns(){return this.cols;}insertColumnsAfter(n,c){this.cols+=c;}setFrozenRows(){}setColumnWidth(){}
    getRange(row,col,height=1,width=1){
      const sheet=this;if(typeof row==='string'){row=1;col=1;}
      const range={setValues(values){values.forEach((r,i)=>{sheet.rows[row+i-1]||=[];r.forEach((v,j)=>sheet.rows[row+i-1][col+j-1]=v);});return range;},getValues(){return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>sheet.rows[row+i-1]?.[col+j-1]??''));},getValue(){return range.getValues()[0][0];},getDisplayValues(){return range.getValues().map(r=>r.map(v=>v===null?'':String(v)));},setValue(v){return range.setValues([[v]]);},setNumberFormat(){return range;},setFontWeight(){return range;},setBackground(){return range;},setWrap(){return range;},insertCheckboxes(){return range;},createTextFinder(text){const finder={matchEntireCell(){return finder;},useRegularExpression(){return finder;},findNext(){return range.getValues().some(r=>r[0]===text)?{}:null;}};return finder;}};return range;
    }
  }
  const oldHeader=Array(30).fill('');oldHeader[3]='Họ và tên';oldHeader[6]='Số thẻ đảng';
  const oldRow=Array(30).fill('');oldRow[2]='CHI BỘ MỘT';oldRow[3]='TÊN CŨ GIẢ LẬP';oldRow[6]='000000000001';oldRow[7]='Địa chỉ nguồn giả lập';
  const oldSheet=new Sheet('2025',headersOnly?[oldHeader]:[oldHeader,oldRow]),sheets={'2025':oldSheet};
  const roster=new Sheet('Danh sách',[['STT','Họ và tên','Ngày tháng năm sinh','Giới tính','Ngày vào Đảng','Ngày chính thức','Số thẻ đảng viên','Chi bộ sinh hoạt đảng'],['1','TÊN MỚI GIẢ LẬP','01/01/1990','','','','000000000001','Chi bộ Một'],['2','THÀNH VIÊN CHƯA CÓ THẺ','10/11/1999','','','','-','Chi bộ Một'],['3','CHI BỘ KHÁC','01/01/1991','','','','000000000002','Chi bộ Hai']]);
  const main={getSheetByName:name=>sheets[name]||null,insertSheet:name=>(sheets[name]=new Sheet(name)),getActiveSheet:()=>sheets['2026']||oldSheet};
  const propsApi={getProperty:key=>props[key]||null,setProperty(key,v){props[key]=v;return this;}};
  const context={console:{log(){}},PropertiesService:{getScriptProperties:()=>propsApi},CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,v)=>cache.set(key,v),remove:key=>cache.delete(key)})},LockService:{getScriptLock:()=>({tryLock:()=>lock,waitLock(){if(!lock)throw Error('busy');},releaseLock(){}})},SpreadsheetApp:{openById:id=>id==='main'?main:{getSheets:()=>[roster]},getActiveSpreadsheet:()=>main,flush(){},getUi:()=>({alert(){}})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput:text=>({text,setMimeType(){return this;}})},DriveApp:{getFolderById:()=>({}),getFileById:id=>({makeCopy(name){copies.push({id,name});return {getId:()=>id+'-copy',getUrl:()=>'synthetic://doc'};}})},DocumentApp:{openById:()=>({getBody:()=>({replaceText(pattern,value){const token=pattern.replace(/\\/g,'');replacements[token]=value;}}),saveAndClose(){}})}};
  context.Date=Date;
  context.Utilities={formatDate(date,timeZone){return new Intl.DateTimeFormat('en-GB',{timeZone,day:'2-digit',month:'2-digit',year:'numeric'}).format(date);}};
  vm.createContext(context);new vm.Script(fs.readFileSync(path.resolve(__dirname,'../apps-script/Code.gs'),'utf8')).runInContext(context);
  const post=data=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(data)}}).text),get=params=>JSON.parse(context.doGet({parameter:params}).text);
  return {context,post,get,sheets,oldSheet,copies,replacements};
}
const valid=()=>({apiVersion:'2026.1',year:2026,requestId:'synthetic-request-0001',chiBo:'CHI BỘ MỘT',hoTen:'NGƯỜI KIỂM THỬ',ngaySinh:'02/02/1992',soThe:'000000000009',noiO:'Địa chỉ người dùng đã sửa',checkNoiO:false});
test('Lưu đúng trang 2026, đúng giá trị đã sửa và giữ nguyên dữ liệu 2025',()=>{const h=setup(),before=JSON.stringify(h.oldSheet.rows);const result=h.post(valid());assert.equal(result.result,'success');assert.equal(h.sheets['2026'].rows.length,2);const row=h.sheets['2026'].rows[1];assert.equal(row[4],'02/02/1992');assert.equal(row[6],'000000000009');assert.equal(row[7],'Địa chỉ người dùng đã sửa');assert.equal(row[22],'K');assert.equal(JSON.stringify(h.oldSheet.rows),before);});
test('Cùng mã gửi chỉ ghi một lần; tra cứu biên nhận không trả thông tin cá nhân',()=>{const h=setup();h.post(valid());assert.equal(h.post(valid()).duplicate,true);assert.equal(h.sheets['2026'].rows.length,2);assert.deepEqual(h.get({action:'receipt',requestId:valid().requestId}),{apiVersion:'2026.1',result:'success',saved:true,year:2026});});
test('Không có khóa, ngày sai, thiếu địa chỉ, thiếu thẻ hoặc phiên bản cũ đều không ghi',()=>{let h=setup({lock:false});assert.equal(h.post(valid()).result,'error');assert.equal(h.sheets['2026'],undefined);for(const patch of [{ngaySinh:'31/02/1990'},{noiO:''},{soThe:'123'},{apiVersion:'old'},{year:2025}]){h=setup();assert.equal(h.post({...valid(),...patch}).result,'error');assert.equal(h.sheets['2026'],undefined);}});
test('Thu nhập 0 và bình quân 0 được giữ đúng; gia đình thiếu mảng không lỗi',()=>{const h=setup();assert.equal(h.post({...valid(),checkKinhTe:true,thuNhap:'0',soNguoi:'4',checkFamily:true}).result,'success');assert.equal(h.sheets['2026'].rows[1][22],0);assert.equal(h.sheets['2026'].rows[1][23],0);assert.equal(h.sheets['2026'].rows[1][21],'K');});
test('Thành viên chưa có thẻ được phép kê khai khi xác nhận chưa được cấp',()=>{const h=setup();assert.equal(h.post({...valid(),soThe:'',chuaCoThe:true}).result,'success');assert.equal(h.sheets['2026'].rows[1][6],'');});
test('Nội dung giống công thức được ép thành văn bản',()=>{const h=setup();h.post({...valid(),noiO:'=1+1'});assert.equal(h.sheets['2026'].rows[1][7],"'=1+1");});
test('Danh sách chỉ có Chi bộ Một, không gửi ngày sinh, thẻ, nơi ở trong gợi ý',()=>{const h=setup(),result=h.get({action:'members'});assert.equal(result.members.length,2);for(const member of result.members)assert.deepEqual(Object.keys(member).sort(),['hoTen','id']);const m=result.members.find(m=>m.hoTen==='TÊN MỚI GIẢ LẬP');const p=h.get({action:'profile',id:m.id});assert.equal(p.profile.noiO,'Địa chỉ nguồn giả lập');assert.equal(p.profile.ngaySinh,'01/01/1990');});
test('Phiếu xuất lấy dữ liệu đã lưu, đúng năm 2026 và giữ K/0',()=>{const h=setup();h.post(valid());h.context.processOneRow(h.sheets['2026'].rows[1],2,h.sheets['2026']);assert.equal(h.replacements['{{NOI_O}}'],'Địa chỉ người dùng đã sửa');assert.equal(h.replacements['{{NGAY_SINH}}'],'02/02/1992');assert.equal(h.replacements['{{SO_THE}}'],'000000000009');assert.equal(h.replacements['{{NAM}}'],'2026');assert.equal(h.replacements['{{THU_NHAP}}'],'K');h.sheets['2026'].rows[1][22]=0;h.context.processOneRow(h.sheets['2026'].rows[1],2,h.sheets['2026']);assert.equal(h.replacements['{{THU_NHAP}}'],'0');});
test('Không tạo phiếu từ hàng tiêu đề khi chưa có hồ sơ',()=>{const h=setup({headersOnly:true});h.context.createDocFromLastRow();assert.equal(h.copies.length,0);});
test('Callback JSONP không hợp lệ không được chạy như JavaScript',()=>{const h=setup(),result=h.context.doGet({parameter:{action:'members',callback:'alert(1)'}}).text;assert.equal(JSON.parse(result).result,'error');assert.equal(result.startsWith('alert(1)'),false);});
test('Địa chỉ kèm nguyên nhân trong ngoặc được lưu và xuất nguyên nội dung bằng API hiện có',()=>{const h=setup(),address='Địa chỉ mới (Thay đổi do sáp nhập khu phố; Cập nhật số nhà)';assert.equal(h.post({...valid(),noiO:address,lyDoSapNhap:true,lyDoKhac:true,nguyenNhanKhac:'Cập nhật số nhà'}).result,'success');const sheet=h.sheets['2026'];assert.equal(sheet.rows[1][7],address);h.context.processOneRow(sheet.rows[1],2,sheet);assert.equal(h.replacements['{{NOI_O}}'],address);});
test('Điền số lý lịch từ hồ sơ 2025, giữ số 0 đầu và bỏ qua số do trình duyệt tự gửi',()=>{
  const h=setup(),old=h.oldSheet.rows[1];old[5]='000123';old[4]='1/1/1990';
  const data={...valid(),hoTen:'TÊN MỚI GIẢ LẬP',ngaySinh:'01/01/1990',soThe:'000000000001',soLyLich:'123456'};
  assert.equal(h.post(data).result,'success');
  assert.equal(h.sheets['2026'].rows[1][5],'000123');
  const profile=h.get({action:'profile',id:'ten-moi-gia-lap'}).profile;
  assert.deepEqual(Object.keys(profile).sort(),['ngaySinh','noiO','soThe']);
});
test('Ngày ký lấy từ thời điểm gửi theo giờ Việt Nam, kể cả khi qua ngày UTC',()=>{
  const h=setup();h.post(valid());
  const sheet=h.sheets['2026'];sheet.rows[1][1]=new Date('2026-11-09T18:30:00.000Z');
  h.context.processOneRow(sheet.rows[1],2,sheet);
  assert.ok(Object.values(h.replacements).includes('Kiến Tường, ngày 10 tháng 11 năm 2026'));
});
test('Mỗi lượt kê khai mới của cùng một đảng viên được lưu ở một hàng riêng',()=>{
  const h=setup(),first=valid();
  assert.equal(h.post(first).result,'success');
  assert.equal(h.post({...first,requestId:'synthetic-request-0002',noiO:'Địa chỉ mới'}).result,'success');
  const sheet=h.sheets['2026'];
  assert.equal(sheet.rows.length,3);
  assert.equal(sheet.rows[1][7],first.noiO);
  assert.equal(sheet.rows[2][7],'Địa chỉ mới');
});
