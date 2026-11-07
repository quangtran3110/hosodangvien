const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const pause=()=>new Promise(resolve=>setImmediate(resolve));
function setup({delayProfile=false,noCard=false}={}){
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
      if(action==='profile')data.profile={ngaySinh:'01/01/1990',soThe:noCard?'':'000000000001',noiO:'Địa chỉ giả lập ban đầu'};
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
test('Dữ liệu người dùng sửa được gửi nguyên giá trị mới, địa chỉ không phụ thuộc công tắc',async()=>{
  const h=setup();try{await choose(h);h.set('ngaySinh','02/02/1992');h.set('soThe','000000000009');h.set('noiO','Địa chỉ đã chỉnh sửa');assert.equal(h.d.getElementById('checkNoiO').checked,false);h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,true);assert.match(h.d.getElementById('review-content').textContent,/Địa chỉ đã chỉnh sửa/);h.d.getElementById('confirm-send').click();await pause();assert.equal(h.posts.length,1);assert.equal(h.posts[0].ngaySinh,'02/02/1992');assert.equal(h.posts[0].soThe,'000000000009');assert.equal(h.posts[0].noiO,'Địa chỉ đã chỉnh sửa');assert.equal(h.posts[0].year,2026);assert.equal(h.d.getElementById('success-panel').hidden,false);}finally{h.dom.window.close();}
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
test('Chặn ngày không tồn tại, thẻ thiếu số, thu nhập thiếu số người',async()=>{
  const h=setup();try{await choose(h);h.set('ngaySinh','31/02/1990');h.event('dangVienForm','submit');assert.equal(h.d.getElementById('ngaySinh').getAttribute('aria-invalid'),'true');h.set('ngaySinh','01/01/1990');h.set('soThe','123');h.event('dangVienForm','submit');assert.equal(h.d.getElementById('soThe').getAttribute('aria-invalid'),'true');h.set('soThe','000000000001');h.d.getElementById('checkKinhTe').click();h.set('thuNhap','0');h.event('dangVienForm','submit');assert.equal(h.d.getElementById('soNguoi').getAttribute('aria-invalid'),'true');h.set('soNguoi','4');assert.match(h.d.getElementById('average-hint').textContent,/Bình quân: 0 đồng/);h.event('dangVienForm','submit');assert.equal(h.d.getElementById('review-dialog').open,true);}finally{h.dom.window.close();}
});
test('Máy chủ trả lỗi không làm mất biểu mẫu hoặc báo thành công',async()=>{
  const h=setup();try{await choose(h);h.w.fetch=async()=>({json:async()=>({result:'error',message:'Chưa lưu được phiếu thử'})});h.event('dangVienForm','submit');h.d.getElementById('confirm-send').click();await pause();assert.equal(h.d.getElementById('success-panel').hidden,true);assert.equal(h.d.getElementById('dangVienForm').hidden,false);assert.match(h.d.getElementById('review-status').textContent,/Chưa lưu được/);assert.equal(h.d.getElementById('confirm-send').disabled,false);}finally{h.dom.window.close();}
});
