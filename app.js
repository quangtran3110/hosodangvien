(() => {
  'use strict';
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxDzF7a0csELHqGC4aV4R1VcNrwEOvjSnuA5L4B46mEFL_EnYdUlQsH15Hp802HkFuoTQ/exec';
  const VERSION = '2026.1';
  const $ = id => document.getElementById(id);
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ');
  function cleanAddress(text) {
    const note='thay\\s+đổi\\s+địa\\s+chỉ\\s+mới\\s+do\\s+sáp\\s+nhập\\s+tỉnh';
    return String(text||'').replace(new RegExp('[\\(\\[]\\s*'+note+'\\s*[.!]?\\s*[\\)\\]]','giu'),'').split(/\r?\n/).map(line=>line.replace(new RegExp('(?:[,;–—-]\\s*)?'+note+'\\s*[.!]?\\s*$','iu'),'').trim()).filter(Boolean).join('\n').trim();
  }
  const familyFields = [['txtChaDe', 'Cha đẻ'], ['txtMeDe', 'Mẹ đẻ'], ['txtChaVoChong', 'Cha (vợ/chồng)'], ['txtMeVoChong', 'Mẹ (vợ/chồng)'], ['txtVoChong', 'Vợ/Chồng'], ['txtCon', 'Con']];
  const groups = [
    {check:'checkCongTac',title:'Đơn vị công tác',hint:'Thay đổi nghề nghiệp hoặc nơi công tác',fields:[['congTac','Nghề nghiệp, đơn vị công tác mới','textarea']]},
    {check:'checkChucVu',title:'Chức vụ',hint:'Đảng, chính quyền, đoàn thể, doanh nghiệp',fields:[['cvDang','Chức vụ Đảng'],['cvChinhQuyen','Chức vụ chính quyền'],['cvDoanThe','Chức vụ đoàn thể'],['cvDoanhNghiep','Chức vụ doanh nghiệp, đơn vị sự nghiệp']]},
    {check:'checkTrinhDo',title:'Trình độ',hint:'Học vấn, chuyên môn, chính trị, ngoại ngữ',fields:[['gdPhoThong','Giáo dục phổ thông'],['chuyenMon','Chuyên môn nghiệp vụ'],['hocVi','Học vị'],['hocHam','Học hàm'],['lyLuan','Lý luận chính trị'],['ngoaiNgu','Ngoại ngữ']]},
    {check:'checkKhenThuong',title:'Khen thưởng, kỷ luật',hint:'Các hình thức mới trong năm',fields:[['khenThuong','Khen thưởng','textarea'],['kyLuat','Kỷ luật','textarea']]},
    {check:'checkFamily',title:'Gia đình',hint:'Cha, mẹ, vợ/chồng và con',fields:familyFields.map(([id,name])=>[id,name,'textarea'])},
    {check:'checkKinhTe',title:'Kinh tế, thu nhập, tài sản',hint:'Thông tin có thay đổi trong năm',fields:[['thuNhap','Tổng thu nhập hộ gia đình (đồng/năm)','money'],['soNguoi','Số người trong hộ','number'],['nhaO','Nhà ở mới','textarea'],['datO','Đất ở mới','textarea'],['hdKinhTe','Hoạt động kinh tế mới','textarea'],['taiSan','Tài sản mới từ 50 triệu đồng trở lên','textarea']]}
  ];
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  for (const group of groups) {
    const card = el('div','change-card');
    const label = el('label','switch-row'); label.htmlFor = group.check;
    const check = el('input'); check.type = 'checkbox'; check.id = group.check; check.setAttribute('role','switch'); check.setAttribute('aria-expanded','false'); check.setAttribute('aria-controls',group.check+'-fields');
    const track = el('span','switch-track'); track.setAttribute('aria-hidden','true');
    const copy = el('span','switch-copy'); copy.append(el('strong','',group.title),el('small','',group.hint));
    const state = el('span','change-state','Không đổi'); state.setAttribute('aria-hidden','true');
    label.append(check,track,copy,state);
    const fields = el('div','change-fields form-grid'); fields.id = group.check+'-fields'; fields.hidden = true;
    if (group.fields.length > 2) fields.append(el('p','field-hint full','Chỉ điền nội dung có thay đổi.'));
    for (const [id,title,type] of group.fields) {
      const wrap = el('div','field'+(group.fields.length===1?' full':''));
      const fieldLabel = el('label','',title); fieldLabel.htmlFor=id;
      const input = el(type==='textarea'?'textarea':'input'); input.id=id;
      input.maxLength=id==='txtCon'?3000:1500;
      if (type==='textarea') input.rows=2;
      else input.type=type==='number'?'number':'text';
      if (type==='money') {input.inputMode='numeric';input.maxLength=22;input.placeholder='Ví dụ: 120.000.000';}
      if (type==='number') {input.inputMode='numeric';input.min='1';input.max='100';input.step='1';input.placeholder='Ví dụ: 4';}
      wrap.append(fieldLabel,input);
      if(type==='money') wrap.append(el('p','field-hint','Nhập số tiền bằng đồng, không nhập theo triệu đồng.'));
      fields.append(wrap);
    }
    if(group.check==='checkKinhTe'){const hint=el('p','income-preview full');hint.id='average-hint';hint.hidden=true;fields.append(hint);}
    check.addEventListener('change',()=>{fields.hidden=!check.checked;check.setAttribute('aria-expanded',String(check.checked));state.textContent=check.checked?'Có thay đổi':'Không đổi';updateSummary();});
    card.append(label,fields);$('change-groups').append(card);
  }
  const form=$('dangVienForm'), nameInput=$('hoTen'), options=$('member-options'), review=$('review-dialog');
  let members=null, membersPromise=null, profileSequence=0, chosen=null, pending=null, saving=false, dirty=false, backendReady=false, activeOption=-1;
  const profiles=new Map(), edits=new Set(), personalEdits=new Set();
  const value=id=>$(id).value.trim();
  const personalFields=[['hoTen','họ và tên'],['ngaySinh','ngày sinh'],['soThe','số thẻ đảng viên'],['noiO','nơi ở']];
  const pencil='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/></svg>';
  function setPersonalLock(id,locked,available=true) {
    const input=$(id),button=$('edit-'+id);
    input.readOnly=locked;input.classList.toggle('prefilled',locked);button.hidden=!available;
    button.dataset.locked=String(locked);button.classList.toggle('save-personal',!locked&&available);
    if(locked)button.innerHTML=pencil;else button.textContent='Lưu';
    const label=personalFields.find(([key])=>key===id)[1];
    button.setAttribute('aria-label',(locked?'Chỉnh sửa ':'Lưu ')+label);button.title=locked?'Chỉnh sửa':'Lưu';
    button.setAttribute('aria-expanded',String(!locked));
    if(id==='soThe')$('chuaCoThe').disabled=locked;
  }
  for(const [id,label] of personalFields){
    const input=$(id),field=input.closest('.field'),heading=el('div','field-heading'),fieldLabel=field.querySelector('label');
    field.insertBefore(heading,fieldLabel);heading.append(fieldLabel);
    const button=el('button','edit-personal');button.id='edit-'+id;button.type='button';button.setAttribute('aria-controls',id);heading.append(button);
    setPersonalLock(id,false,false);
    button.addEventListener('click',()=>{
      if(input.readOnly){
        personalEdits.add(id);edits.add(id);if(id==='soThe')edits.add('chuaCoThe');
        setPersonalLock(id,false);if(!input.disabled)input.focus();else $('chuaCoThe').focus();return;
      }
      if(id==='noiO')input.value=cleanAddress(input.value);
      const error=personalError(id);
      if(error){input.setAttribute('aria-invalid','true');status('form-status',error,true);if(!input.disabled)input.focus();return;}
      personalEdits.delete(id);input.removeAttribute('aria-invalid');status('form-status','');
      if(id==='hoTen'){
        const changed=chosen&&normalize(input.value)!==normalize(chosen.hoTen);
        if(changed){const match=members&&members.find(member=>normalize(member.hoTen)===normalize(input.value));if(match){chooseMember(match);return;}++profileSequence;clearProfile();}
        input.value=input.value.trim().toLocaleUpperCase('vi-VN');hideOptions();
      }
      setPersonalLock(id,true);
    });
  }
  function resetReasons(){
    $('lyDoSapNhap').checked=false;$('lyDoKhac').checked=false;$('nguyenNhanKhac').value='';syncReasons();
  }
  function syncReasons(){const selected=$('lyDoKhac').checked;$('ly-do-khac-field').hidden=!selected;$('nguyenNhanKhac').disabled=!selected;$('nguyenNhanKhac').required=selected;$('lyDoKhac').setAttribute('aria-expanded',String(selected));updateSummary();}
  function addressReasons(data){return [data.lyDoSapNhap?'Thay đổi do sáp nhập khu phố':'',data.lyDoKhac?data.nguyenNhanKhac:''].filter(Boolean).join('; ');}
  const setHint=(text,kind='')=>{$('member-hint').textContent=text;$('member-hint').hidden=!text;$('member-hint').className='field-hint '+kind;};
  const status=(id,text,error=false)=>{const node=$(id);node.textContent=text;node.hidden=!text;node.className='notice'+(error?' error':'');};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function api(params,timeout=18000){
    return new Promise((resolve,reject)=>{
      const callback='hsdv_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const url=new URL(SCRIPT_URL);Object.entries({...params,callback}).forEach(([key,val])=>url.searchParams.set(key,val));
      let done=false;
      const clean=()=>{clearTimeout(timer);script.remove();delete window[callback];};
      const finish=(error,data)=>{if(done)return;done=true;clean();if(error)reject(error);else resolve(data);};
      const timer=setTimeout(()=>finish(new Error('Kết nối đang chậm. Vui lòng thử lại.')),timeout);
      window[callback]=data=>{if(data.apiVersion===VERSION)backendReady=true;if(data.result==='error')finish(new Error(data.message||'Không thể tải dữ liệu.'));else finish(null,data);};
      script.onerror=()=>finish(new Error('Chưa kết nối được dữ liệu. Đồng chí có thể nhập trực tiếp.'));
      script.src=url.href;script.async=true;script.referrerPolicy='no-referrer';document.head.append(script);
    });
  }
  function loadMembers(){
    if(members)return Promise.resolve(members);
    if(membersPromise)return membersPromise;
    setHint('Đang tải danh sách Chi bộ Một…');
    membersPromise=api({action:'members'}).then(data=>{
      members=Array.isArray(data.members)?data.members.filter(m=>typeof m.id==='string'&&typeof m.hoTen==='string'):[];
      setHint('Nhập tên có dấu hoặc không dấu, rồi chọn đúng thành viên.');
      return members;
    }).catch(error=>{setHint(error.message,'error');throw error;}).finally(()=>{membersPromise=null;});
    return membersPromise;
  }
  function hideOptions(){options.hidden=true;nameInput.setAttribute('aria-expanded','false');nameInput.removeAttribute('aria-activedescendant');activeOption=-1;}
  function showOptions(){
    if(nameInput.readOnly||value('chiBo')!=='CHI BỘ MỘT'||!members)return hideOptions();
    const tokens=normalize(nameInput.value).split(' ').filter(Boolean);
    const filtered=members.filter(m=>tokens.every(t=>normalize(m.hoTen).includes(t)));
    options.replaceChildren();activeOption=-1;
    for(const [i,member] of filtered.entries()){
      const li=el('li');li.setAttribute('role','presentation');
      const button=el('button','',member.hoTen);button.type='button';button.setAttribute('role','option');button.id='member-option-'+i;button.setAttribute('aria-selected','false');
      button.addEventListener('pointerdown',event=>event.preventDefault());
      button.addEventListener('click',()=>{if(personalEdits.has('hoTen')){nameInput.value=member.hoTen;hideOptions();}else chooseMember(member);});li.append(button);options.append(li);
    }
    options.hidden=!filtered.length;nameInput.setAttribute('aria-expanded',String(Boolean(filtered.length)));
  }
  function syncCard(){const checked=$('chuaCoThe').checked;$('soThe').disabled=checked;$('soThe').required=!checked;$('card-required').hidden=checked;}
  function clearProfile(){personalEdits.clear();for(const [id] of personalFields){if(id!=='hoTen')$(id).value='';setPersonalLock(id,false,false);}$('chuaCoThe').checked=false;syncCard();resetReasons();chosen=null;}
  async function chooseMember(member){
    const seq=++profileSequence;
    clearProfile();nameInput.value=member.hoTen;setPersonalLock('hoTen',true);chosen=member;edits.clear();hideOptions();setHint('Đang điền thông tin của '+member.hoTen+'…');
    try{
      const data=profiles.has(member.id)?profiles.get(member.id):await api({action:'profile',id:member.id});
      if(seq!==profileSequence||value('chiBo')!=='CHI BỘ MỘT')return;
      const profile=data.profile;if(!profile)throw new Error('Chưa có thông tin điền sẵn. Vui lòng nhập trực tiếp.');
      profiles.set(member.id,data);
      for(const id of ['ngaySinh','soThe','noiO'])if(!edits.has(id)){const filled=id==='noiO'?cleanAddress(profile[id]):String(profile[id]||'');$(id).value=filled;setPersonalLock(id,Boolean(filled),Boolean(filled));}
      if(!edits.has('soThe')&&!edits.has('chuaCoThe')){$('chuaCoThe').checked=!profile.soThe;syncCard();setPersonalLock('soThe',true);}
      setHint(value('noiO')?'':'Vui lòng bổ sung nơi ở hiện tại.','good');
    }catch(error){if(seq===profileSequence)setHint(error.message,'error');}
  }
  $('chiBo').addEventListener('change',()=>{
    ++profileSequence;if(chosen){clearProfile();nameInput.value='';}hideOptions();
    if(value('chiBo')==='CHI BỘ MỘT')loadMembers().catch(()=>{});
    else setHint('Nhập thông tin của đồng chí theo các ô bên dưới.');
  });
  for(const id of ['ngaySinh','soThe','noiO','chuaCoThe'])$(id).addEventListener('input',()=>edits.add(id));
  $('chuaCoThe').addEventListener('change',syncCard);
  $('lyDoSapNhap').addEventListener('change',updateSummary);
  $('lyDoKhac').addEventListener('change',syncReasons);
  nameInput.addEventListener('input',()=>{
    if(!personalEdits.has('hoTen')&&chosen&&normalize(nameInput.value)!==normalize(chosen.hoTen)){++profileSequence;clearProfile();}
    if(value('chiBo')==='CHI BỘ MỘT')loadMembers().then(()=>{if(document.activeElement===nameInput)showOptions();}).catch(()=>{});
  });
  nameInput.addEventListener('focus',()=>{if(value('chiBo')==='CHI BỘ MỘT')loadMembers().then(()=>{if(document.activeElement===nameInput)showOptions();}).catch(()=>{});});
  nameInput.addEventListener('blur',()=>{
    setTimeout(()=>{if(!options.contains(document.activeElement))hideOptions();},120);
    if(!personalEdits.has('hoTen')&&!nameInput.readOnly&&!chosen&&value('chiBo')==='CHI BỘ MỘT'&&members){const match=members.find(m=>normalize(m.hoTen)===normalize(nameInput.value));if(match)chooseMember(match);}
  });
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Escape'){hideOptions();return;}
    if(!['ArrowDown','ArrowUp','Enter'].includes(event.key)||options.hidden)return;
    const buttons=[...options.querySelectorAll('button')];if(!buttons.length)return;event.preventDefault();
    if(event.key==='Enter'){if(activeOption>=0)buttons[activeOption].click();return;}
    activeOption=(activeOption+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
    buttons.forEach((b,i)=>b.setAttribute('aria-selected',String(i===activeOption)));
    nameInput.setAttribute('aria-activedescendant',buttons[activeOption].id);buttons[activeOption].scrollIntoView({block:'nearest'});
  });
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.autocomplete'))hideOptions();});
  $('ngaySinh').addEventListener('input',()=>{const digits=$('ngaySinh').value.replace(/\D/g,'').slice(0,8);$('ngaySinh').value=[digits.slice(0,2),digits.slice(2,4),digits.slice(4)].filter(Boolean).join('/');});
  $('soThe').addEventListener('input',()=>{$('soThe').value=$('soThe').value.replace(/\D/g,'');});
  function money(raw){const str=String(raw).trim();return /^(?:\d+|\d{1,3}(?:[., ]\d{3})+)$/.test(str)?Number(str.replace(/[., ]/g,'')):NaN;}
  function updateAverage(){const income=money(value('thuNhap')),people=Number(value('soNguoi'));const visible=Number.isSafeInteger(income)&&income>=0&&Number.isInteger(people)&&people>0;$('average-hint').hidden=!visible;if(visible)$('average-hint').textContent='Bình quân: '+Math.round(income/people).toLocaleString('vi-VN')+' đồng/người/năm.';}
  $('thuNhap').addEventListener('input',updateAverage);$('soNguoi').addEventListener('input',updateAverage);
  $('thuNhap').addEventListener('blur',()=>{const amount=money(value('thuNhap'));if(Number.isSafeInteger(amount)&&amount>=0)$('thuNhap').value=amount.toLocaleString('vi-VN');});
  function updateSummary(){const count=groups.filter(g=>$(g.check).checked).length+Number($('lyDoSapNhap').checked||$('lyDoKhac').checked);$('change-summary').textContent=count?'Đã đánh dấu '+count+' mục có thay đổi.':'Chưa đánh dấu nội dung thay đổi.';}
  function collect(){
    const data={apiVersion:VERSION,year:2026,chiBo:value('chiBo'),hoTen:value('hoTen').toLocaleUpperCase('vi-VN'),ngaySinh:value('ngaySinh'),soThe:$('chuaCoThe').checked?'':value('soThe'),chuaCoThe:$('chuaCoThe').checked,noiO:cleanAddress(value('noiO')),lyDoSapNhap:$('lyDoSapNhap').checked,lyDoKhac:$('lyDoKhac').checked,nguyenNhanKhac:$('lyDoKhac').checked?value('nguyenNhanKhac'):''};
    const reason=addressReasons(data);if(reason)data.noiO+=' ('+reason+')';
    for(const group of groups){data[group.check]=$(group.check).checked;for(const [id] of group.fields)if(!id.startsWith('txt'))data[id]=value(id);}
    data.familyRows=data.checkFamily?familyFields.map(([id,quanHe])=>({quanHe,noiDung:value(id)})).filter(row=>row.noiDung):[];
    return data;
  }
  function personalError(id){
    if(id==='hoTen'&&!value(id))return 'Vui lòng nhập họ và tên.';
    if(id==='ngaySinh'){
      const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value(id)),date=match&&new Date(Number(match[3]),Number(match[2])-1,Number(match[1]));
      if(!match||date.getFullYear()!==Number(match[3])||date.getMonth()+1!==Number(match[2])||date.getDate()!==Number(match[1])||Number(match[3])<1900||date>new Date())return 'Vui lòng nhập ngày sinh hợp lệ theo dd/mm/yyyy.';
    }
    if(id==='soThe'&&!$('chuaCoThe').checked&&!/^\d{12}$/.test(value(id)))return 'Số thẻ đảng viên phải gồm 12 chữ số, hoặc chọn chưa được cấp thẻ.';
    if(id==='noiO'&&!cleanAddress(value(id)))return 'Vui lòng kiểm tra và bổ sung nơi ở hiện tại.';
    return '';
  }
  function validate(){
    form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
    if(personalEdits.size){const id=[...personalEdits][0],label=personalFields.find(([key])=>key===id)[1];status('form-status','Bấm Lưu ở ô '+label+' trước khi gửi hồ sơ.',true);$('edit-'+id).focus();return false;}
    const d=collect(),errors=[];
    if(!d.chiBo)errors.push(['chiBo','Vui lòng chọn chi bộ.']);
    for(const [id] of personalFields){const error=personalError(id);if(error)errors.push([id,error]);}
    if(d.noiO.length>1500)errors.push(['noiO','Địa chỉ và nguyên nhân quá dài. Vui lòng rút gọn.']);
    if(d.lyDoKhac&&!d.nguyenNhanKhac)errors.push(['nguyenNhanKhac','Vui lòng nhập nguyên nhân khác hoặc bỏ chọn ô “Khác”.']);
    if(d.checkKinhTe&&d.thuNhap){const amount=money(d.thuNhap);if(!Number.isSafeInteger(amount)||amount<0)errors.push(['thuNhap','Nhập tổng thu nhập bằng số tiền đồng, ví dụ 120.000.000.']);if(!/^\d+$/.test(d.soNguoi)||Number(d.soNguoi)<1||Number(d.soNguoi)>100)errors.push(['soNguoi','Vui lòng nhập số người trong hộ từ 1 đến 100.']);}
    if(errors.length){for(const [id] of errors)$(id).setAttribute('aria-invalid','true');status('form-status',errors[0][1],true);const id=errors[0][0];if(personalFields.some(([key])=>key===id)&&$(id).readOnly){personalEdits.add(id);setPersonalLock(id,false);}$(id).focus();return false;}
    status('form-status','');return true;
  }
  function fillReview(data){
    const rows=[['Năm kê khai','2026'],['Chi bộ',data.chiBo],['Họ và tên',data.hoTen],['Ngày sinh',data.ngaySinh],['Số thẻ đảng viên',data.chuaCoThe?'Chưa được cấp thẻ':data.soThe],['Nơi ở',data.noiO]];
    for(const group of groups){if(!data[group.check]){rows.push([group.title,'K — Không thay đổi']);continue;}for(const [id,label] of group.fields)rows.push([label,value(id)||'K']);}
    $('review-content').replaceChildren();for(const [title,text] of rows){const row=el('div');row.append(el('dt','',title),el('dd','',text));$('review-content').append(row);}
  }
  form.addEventListener('submit',event=>{event.preventDefault();if(saving||!validate())return;hideOptions();fillReview(collect());status('review-status','');review.showModal();});
  for(const id of ['close-review','back-to-edit'])$(id).addEventListener('click',()=>{if(!saving)review.close();});
  review.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  async function send(data){
    if(!backendReady){const health=await api({action:'health'});if(health.apiVersion!==VERSION)throw new Error('Biểu mẫu đang được cập nhật. Vui lòng tải lại trang sau ít phút.');}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),mode:'cors',credentials:'omit',redirect:'follow',signal:controller.signal});
      const result=await response.json();
      if(result.result==='success'&&result.requestId===data.requestId&&result.year===2026)return result;
      if(result.result==='error'){const error=new Error(result.message||'Chưa lưu được phiếu. Vui lòng kiểm tra lại.');error.confirmed=true;throw error;}
      throw new Error('Chưa nhận được xác nhận lưu.');
    }catch(error){
      if(error.confirmed)throw error;
      for(const delay of [600,1400,2400]){await wait(delay);try{const receipt=await api({action:'receipt',requestId:data.requestId});if(receipt.saved&&receipt.year===2026)return {result:'success',requestId:data.requestId,year:2026};}catch{/* Giữ nguyên biểu mẫu để thử lại cùng mã gửi. */}}
      throw new Error('Chưa xác nhận được đã lưu. Thông tin vẫn được giữ trên trang; đồng chí hãy thử gửi lại.');
    }finally{clearTimeout(timer);}
  }
  $('confirm-send').addEventListener('click',async()=>{
    if(saving||!validate())return;
    const data=collect(),fingerprint=JSON.stringify(data);
    if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};
    data.requestId=pending.id;saving=true;
    const controls=[...form.elements,...review.querySelectorAll('button')];const previous=controls.map(node=>node.disabled);controls.forEach(node=>node.disabled=true);$('confirm-send').textContent='Đang lưu…';status('review-status','Đang gửi phiếu, vui lòng chờ xác nhận.');
    try{await send(data);dirty=false;review.close();form.hidden=true;$('success-panel').hidden=false;$('success-message').textContent='Đã ghi nhận phiếu của đồng chí '+data.hoTen+'.';$('success-panel').focus();window.scrollTo({top:0,behavior:'smooth'});}
    catch(error){status('review-status',error.message,true);}
    finally{saving=false;controls.forEach((node,i)=>node.disabled=previous[i]);$('confirm-send').textContent='Xác nhận gửi';}
  });
  form.addEventListener('input',event=>{dirty=true;event.target.removeAttribute('aria-invalid');});
  form.addEventListener('change',()=>{dirty=true;});
  window.addEventListener('beforeunload',event=>{if(dirty&&!form.hidden){event.preventDefault();event.returnValue='';}});
  $('new-form').addEventListener('click',()=>{++profileSequence;form.reset();clearProfile();edits.clear();pending=null;dirty=false;groups.forEach(g=>{$(g.check+'-fields').hidden=true;$(g.check).setAttribute('aria-expanded','false');$(g.check).closest('.switch-row').querySelector('.change-state').textContent='Không đổi';});hideOptions();updateSummary();status('form-status','');$('average-hint').hidden=true;setHint('Chọn Chi bộ Một để sử dụng gợi ý thành viên.');$('success-panel').hidden=true;form.hidden=false;$('chiBo').focus();});
})();
