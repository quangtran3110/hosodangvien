const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const pause=()=>new Promise(resolve=>setImmediate(resolve));
function setup({delayProfile=false,noCard=false,address='Địa chỉ giả lập ban đầu'}={}){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const calls=[],posts=[],deferred=[];
  const nativeAppend=d.head.append.bind(d.head);
  d.head.append=(...nodes)=>{
    nativeAppend(...nodes);
    for(const node of nodes)if(node.tagName==='SCRIPT'&&node.src){
      const params=new URL(node.src).searchParams,action=params.get('action');calls.push(action);
      let data={apiVersion:'2026.1',result:'success',year:2026};
      if(action==='members')data.members=[{id:'kiem',hoTen:'NGUYỄN VĂN KIỂM'},{id:'thu',hoTen:'ĐẶNG THỊ THỬ'}];
      if(action==='profile')data.profile={ngaySinh:'01/01/1990',soThe:noCard?'':'000000000001',noiO:address};
      const deliver=()=>{const cb=w[params.get('callback')];if(cb)cb(data);};
      if(action==='profile'&&delayProfile)deferred.push(deliver);else queueMicrotask(deliver);
    }
  };
  w.fetch=async(url,options)=>{const data=JSON.parse(options.body);posts.push(data);return {json:async()=>({result:'success',year:2026,requestId:data.requestId})};};
  w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));
  const event=(id,type)=>d.getElementById(id).dispatchEvent(new w.Event(type,{bubbles:true}));
  const set=(id,value,type='input')=>{d.getElementById(id).value=value;event(id,type);};
  return {dom,w,d,calls,posts,deferred,event,set};
}
async function choose(h){h.set('chiBo','CHI BỘ MỘT','change');await pause();h.d.getElementById('hoTen').focus();h.set('hoTen','nguyen kiem');await pause();h.d.querySelector('#member-options button').click();await pause();}
test('Gợi ý tên không dấu, danh sách chỉ tải một lần, chọn tên điền thông tin',async()=>{
  const h=setup();try{await choose(h);assert.equal(h.d.getElementById('ngaySinh').value,'01/01/1990');assert.equal(h.d.getElementById('soThe').value,'000000000001');assert.equal(h.d.getElementById('noiO').value,'Địa chỉ giả lập ban đầu');assert.equal(h.calls.filter(x=>x==='members').length,1);assert.equal(h.d.getElementById('noiO').disabled,false);}finally{h.dom.window.close();}
});
test('Bấm cây bút để sửa rồi gửi đúng giá trị mới, không cần đánh dấu thay đổi nơi ở',async()=>{
  const h=setup();try{await choose(h);for(const id of ['ngaySinh','soThe','noiO'])h.d.getElementById('edit-'+id).click();h.set('ngaySinh','02/02/1992');h.set('soThe','000000000009');h.set('noiO','Địa chỉ đã chỉnh sửa');assert.equal(h.d.getElementById('checkNoiO'),null);h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,false);assert.equal(h.posts.length,0);for(const id of ['ngaySinh','soThe','noiO']){assert.equal(h.d.getElementById('edit-'+id).textContent,'Lưu');h.d.getElementById('edit-'+id).click();}h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,true);assert.match(h.d.getElementById('review-content').textContent,/Địa chỉ đã chỉnh sửa/);h.d.getElementById('confirm-send').click();await pause();assert.equal(h.posts.length,1);assert.equal(h.posts[0].ngaySinh,'02/02/1992');assert.equal(h.posts[0].soThe,'000000000009');assert.equal(h.posts[0].noiO,'Địa chỉ đã chỉnh sửa');assert.equal(h.posts[0].lyDoSapNhap,false);assert.equal(h.posts[0].lyDoKhac,false);assert.equal(h.posts[0].year,2026);assert.equal(h.d.getElementById('success-panel').hidden,false);}finally{h.dom.window.close();}
});
test('Thông tin điền sẵn khóa cho đến khi bấm bút; có thể hoàn tất và khóa lại',async()=>{
  const h=setup();try{await choose(h);for(const id of ['hoTen','ngaySinh','soThe','noiO']){assert.equal(h.d.getElementById(id).readOnly,true);const button=h.d.getElementById('edit-'+id);assert.equal(button.hidden,false);button.click();assert.equal(h.d.getElementById(id).readOnly,false);button.click();assert.equal(h.d.getElementById(id).readOnly,true);}assert.equal(h.d.getElementById('chuaCoThe').disabled,true);h.d.getElementById('edit-soThe').click();assert.equal(h.d.getElementById('chuaCoThe').disabled,false);}finally{h.dom.window.close();}
});
test('Địa chỉ chưa có để nhập trực tiếp; dữ liệu cũ chỉ loại ghi chú sáp nhập tỉnh',async()=>{
  const h=setup({address:'12 Đường Giả Lập (gần trường học)\n(Thay đổi địa chỉ mới do sáp nhập tỉnh)'});try{await choose(h);assert.equal(h.d.getElementById('noiO').value,'12 Đường Giả Lập (gần trường học)');assert.equal(h.d.getElementById('noiO').readOnly,true);}finally{h.dom.window.close();}
  const empty=setup({address:''});try{await choose(empty);assert.equal(empty.d.getElementById('noiO').readOnly,false);assert.equal(empty.d.getElementById('edit-noiO').hidden,true);}finally{empty.dom.window.close();}
});
test('Hai nguyên nhân được chọn độc lập, lưu và xuất trong ngoặc sau địa chỉ qua API hiện có',async()=>{
  const h=setup();try{await choose(h);h.d.getElementById('lyDoSapNhap').click();h.d.getElementById('lyDoKhac').click();assert.equal(h.d.getElementById('ly-do-khac-field').hidden,false);h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,false);assert.equal(h.d.getElementById('nguyenNhanKhac').getAttribute('aria-invalid'),'true');h.set('nguyenNhanKhac','Chuyển nơi ở');h.event('dangVienForm','submit');assert.match(h.d.getElementById('review-content').textContent,/Địa chỉ giả lập ban đầu \(Thay đổi do sáp nhập khu phố; Chuyển nơi ở\)/);h.d.getElementById('confirm-send').click();await pause();assert.equal(h.posts[0].noiO,'Địa chỉ giả lập ban đầu (Thay đổi do sáp nhập khu phố; Chuyển nơi ở)');assert.equal(h.posts[0].nguyenNhanKhac,'Chuyển nơi ở');assert.equal(h.posts[0].lyDoSapNhap,true);assert.equal(h.posts[0].lyDoKhac,true);}finally{h.dom.window.close();}
});
test('Bỏ chọn Khác không gửi nguyên nhân cũ; đổi thành viên xóa các nguyên nhân',async()=>{
  const h=setup();try{await choose(h);h.d.getElementById('lyDoKhac').click();h.set('nguyenNhanKhac','Nội dung không gửi');h.d.getElementById('lyDoKhac').click();assert.equal(h.d.getElementById('nguyenNhanKhac').disabled,true);h.event('dangVienForm','submit');h.d.getElementById('confirm-send').click();await pause();assert.equal(h.posts[0].nguyenNhanKhac,'');h.d.getElementById('new-form').click();assert.equal(h.d.getElementById('lyDoKhac').checked,false);assert.equal(h.d.getElementById('hoTen').readOnly,false);await choose(h);h.d.getElementById('lyDoSapNhap').click();h.d.getElementById('edit-hoTen').click();h.set('hoTen','dang thu');await pause();h.d.querySelector('#member-options button').click();assert.equal(h.d.getElementById('lyDoSapNhap').checked,true);assert.equal(h.d.getElementById('hoTen').readOnly,false);h.d.getElementById('edit-hoTen').click();await pause();assert.equal(h.d.getElementById('lyDoSapNhap').checked,false);assert.equal(h.d.getElementById('ngaySinh').readOnly,true);}finally{h.dom.window.close();}
});
test('Thông tin trả về chậm không ghi đè ô người dùng đang sửa',async()=>{
  const h=setup({delayProfile:true});try{await choose(h);h.set('noiO','Địa chỉ người dùng đang nhập');h.deferred[0]();await pause();assert.equal(h.d.getElementById('noiO').value,'Địa chỉ người dùng đang nhập');assert.equal(h.d.getElementById('ngaySinh').value,'01/01/1990');}finally{h.dom.window.close();}
});
test('Đổi chi bộ hủy thông tin điền sẵn đang tải',async()=>{
  const h=setup({delayProfile:true});try{await choose(h);h.set('chiBo','CHI BỘ HAI','change');h.deferred[0]();await pause();assert.equal(h.d.getElementById('ngaySinh').value,'');assert.equal(h.d.getElementById('soThe').value,'');assert.equal(h.d.getElementById('noiO').value,'');}finally{h.dom.window.close();}
});
test('Bấm cả hàng công tắc mở/đóng nội dung và giữ nội dung khi bật lại',()=>{
  const h=setup();try{const cb=h.d.getElementById('checkCongTac');const label=cb.closest('label');label.click();assert.equal(cb.checked,true);assert.equal(h.d.getElementById('checkCongTac-fields').hidden,false);h.set('congTac','Đơn vị mới giả lập');label.click();assert.equal(cb.checked,false);assert.equal(h.d.getElementById('checkCongTac-fields').hidden,true);label.click();assert.equal(h.d.getElementById('congTac').value,'Đơn vị mới giả lập');}finally{h.dom.window.close();}
});
test('Thành viên chưa có thẻ không bị chặn và không gửi số thẻ cũ',async()=>{
  const h=setup({noCard:true});try{await choose(h);assert.equal(h.d.getElementById('chuaCoThe').checked,true);assert.equal(h.d.getElementById('soThe').disabled,true);h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,true);h.d.getElementById('confirm-send').click();await pause();assert.equal(h.posts[0].chuaCoThe,true);assert.equal(h.posts[0].soThe,'');}finally{h.dom.window.close();}
});
test('Bấm Lưu chặn ngày không tồn tại và thẻ thiếu số; gửi chặn thu nhập thiếu số người',async()=>{
  const h=setup();try{await choose(h);h.d.getElementById('edit-ngaySinh').click();h.set('ngaySinh','31/02/1990');h.d.getElementById('edit-ngaySinh').click();assert.equal(h.d.getElementById('ngaySinh').getAttribute('aria-invalid'),'true');assert.equal(h.d.getElementById('ngaySinh').readOnly,false);h.set('ngaySinh','01/01/1990');h.d.getElementById('edit-ngaySinh').click();h.d.getElementById('edit-soThe').click();h.set('soThe','123');h.d.getElementById('edit-soThe').click();assert.equal(h.d.getElementById('soThe').getAttribute('aria-invalid'),'true');h.set('soThe','000000000001');h.d.getElementById('edit-soThe').click();h.d.getElementById('checkKinhTe').click();h.set('thuNhap','0');h.event('dangVienForm','submit');assert.equal(h.d.getElementById('soNguoi').getAttribute('aria-invalid'),'true');h.set('soNguoi','4');assert.match(h.d.getElementById('average-hint').textContent,/Bình quân: 0 đồng/);h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,true);}finally{h.dom.window.close();}
});
test('Từng ô đang sửa đều cần Lưu, kể cả đánh dấu chưa có thẻ',async()=>{
  for(const id of ['hoTen','ngaySinh','soThe','noiO']){const h=setup();try{await choose(h);h.d.getElementById('edit-'+id).click();if(id==='soThe')h.d.getElementById('chuaCoThe').click();h.event('dangVienForm','submit');h.d.getElementById('confirm-send').click();await pause();assert.equal(h.posts.length,0);assert.match(h.d.getElementById('form-status').textContent,/Bấm Lưu/);h.d.getElementById('edit-'+id).click();h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,true);}finally{h.dom.window.close();}}
});
test('Máy chủ trả lỗi không làm mất biểu mẫu hoặc báo thành công',async()=>{
  const h=setup();try{await choose(h);h.w.fetch=async()=>({json:async()=>({result:'error',message:'Chưa lưu được phiếu thử'})});h.event('dangVienForm','submit');h.d.getElementById('confirm-send').click();await pause();assert.equal(h.d.getElementById('success-panel').hidden,true);assert.equal(h.d.getElementById('dangVienForm').hidden,false);assert.match(h.d.getElementById('review-status').textContent,/Chưa lưu được/);assert.equal(h.d.getElementById('confirm-send').disabled,false);}finally{h.dom.window.close();}
});
