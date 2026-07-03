
(function(){

  // ---------- Storage helpers ----------
  // Persists to localStorage, namespaced so this app can share a browser profile
  // with other sites without key collisions. Falls back to an in-memory store
  // if localStorage is unavailable (e.g. private-browsing edge cases).
  var STORE_PREFIX = 'tiespro_costing_v1:';
  var memoryStore = {};
  var hasLocalStorage = (function(){
    try{ var k='__tiespro_test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }
    catch(e){ return false; }
  })();

  async function storeGet(key){
    if(hasLocalStorage){
      var v = localStorage.getItem(STORE_PREFIX+key);
      return v===null ? null : v;
    }
    return memoryStore.hasOwnProperty(key) ? memoryStore[key] : null;
  }
  async function storeSet(key,value){
    if(hasLocalStorage){
      try{ localStorage.setItem(STORE_PREFIX+key, value); return true; }catch(e){ return false; }
    }
    memoryStore[key]=value; return true;
  }
  async function storeListKeys(prefix){
    if(hasLocalStorage){
      var keys=[];
      for(var i=0;i<localStorage.length;i++){
        var full = localStorage.key(i);
        if(full && full.indexOf(STORE_PREFIX+prefix)===0) keys.push(full.slice(STORE_PREFIX.length));
      }
      return keys;
    }
    return Object.keys(memoryStore).filter(function(k){return k.indexOf(prefix)===0;});
  }
  async function storeDelete(key){
    if(hasLocalStorage){
      try{ localStorage.removeItem(STORE_PREFIX+key); return true; }catch(e){ return false; }
    }
    delete memoryStore[key]; return true;
  }

  function fmtR(n){
    n = Math.round(n||0);
    return 'R' + n.toLocaleString('en-ZA');
  }
  function toast(msg){
    var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},2600);
  }
  function todayISO(){ return new Date().toISOString().slice(0,10); }

  // Escape user-generated text before injecting it into innerHTML.
  function escapeHtml(str){
    if(str == null) return '';
    return String(str).replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  // =====================================================================
  // STAFF DIRECTORY, ROLES & SIGN-IN
  // =====================================================================
  // No staff ship with this tool. The first person to open it on a device
  // creates the first (Manager) account themselves - avoids ever putting
  // real names/PINs in source control, and lets each install have its own
  // team roster.
  var staffDirectory = [];
  var currentUser = null;

  async function loadStaff(){
    var saved = await storeGet('staff_directory');
    if(saved){
      try{ staffDirectory = JSON.parse(saved); }catch(e){ staffDirectory = []; }
    } else {
      staffDirectory = [];
    }
  }
  async function saveStaff(){
    await storeSet('staff_directory', JSON.stringify(staffDirectory));
  }

  function populateLoginNames(){
    var sel = document.getElementById('loginName');
    sel.innerHTML = staffDirectory.map(function(s){
      return '<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.name)+' ('+(s.role==='manager'?'Manager':'Staff')+')</option>';
    }).join('');
  }

  function applyRoleVisibility(){
    var isManager = currentUser && currentUser.role === 'manager';
    document.querySelectorAll('.role-manager').forEach(function(el){
      if(isManager){
        el.classList.remove('hidden-role');
      } else {
        el.classList.add('hidden-role');
        if(el.classList.contains('tabpanel') && el.classList.contains('active')){
          el.classList.remove('active');
          document.getElementById('tab-build').classList.add('active');
        }
        if(el.classList.contains('tab-btn') && el.classList.contains('active')){
          el.classList.remove('active');
          document.querySelector('.tab-btn[data-tab="build"]').classList.add('active');
        }
      }
    });
  }

  async function doLogin(userId, pin){
    var user = staffDirectory.find(function(s){ return s.id===userId; });
    if(!user || user.pin !== pin) return false;
    currentUser = {id:user.id, name:user.name, role:user.role};
    await storeSet('session', JSON.stringify(currentUser));
    onLoginSuccess();
    return true;
  }

  function onLoginSuccess(){
    document.getElementById('loginOverlay').style.display='none';
    var whoami = document.getElementById('whoamiBox');
    whoami.style.display='inline-block';
    document.getElementById('whoamiName').textContent = currentUser.name;
    document.getElementById('whoamiRole').textContent = '('+(currentUser.role==='manager'?'Manager':'Staff')+')';
    document.getElementById('preparedBy').value = currentUser.name;
    applyRoleVisibility();
    calcAll();
  }

  async function tryAutoLogin(){
    var saved = await storeGet('session');
    if(saved){
      try{
        var u = JSON.parse(saved);
        if(staffDirectory.find(function(s){return s.id===u.id;})){
          currentUser = u;
          onLoginSuccess();
          return;
        }
      }catch(e){}
    }
    document.getElementById('loginOverlay').style.display='flex';
    if(staffDirectory.length === 0){
      document.getElementById('loginPane').style.display='none';
      document.getElementById('setupPane').style.display='block';
    } else {
      document.getElementById('loginPane').style.display='block';
      document.getElementById('setupPane').style.display='none';
      populateLoginNames();
    }
  }

  document.getElementById('btnLogin').addEventListener('click', async function(){
    var userId = document.getElementById('loginName').value;
    var pin = document.getElementById('loginPin').value.trim();
    var ok = await doLogin(userId, pin);
    if(!ok){
      document.getElementById('loginErr').style.display='block';
    } else {
      document.getElementById('loginErr').style.display='none';
      document.getElementById('loginPin').value='';
    }
  });
  document.getElementById('loginPin').addEventListener('keydown', function(e){
    if(e.key==='Enter') document.getElementById('btnLogin').click();
  });

  document.getElementById('btnSetup').addEventListener('click', async function(){
    var name = document.getElementById('setupName').value.trim();
    var pin = document.getElementById('setupPin').value.trim();
    if(!name || !/^[0-9]{4,6}$/.test(pin)){
      document.getElementById('setupErr').style.display='block';
      return;
    }
    document.getElementById('setupErr').style.display='none';
    var user = {id:'u'+Date.now(), name:name, pin:pin, role:'manager'};
    staffDirectory = [user];
    await saveStaff();
    currentUser = {id:user.id, name:user.name, role:user.role};
    await storeSet('session', JSON.stringify(currentUser));
    populateLoginNames();
    renderStaffTable();
    onLoginSuccess();
    toast('Manager account created: '+name);
  });
  document.getElementById('setupPin').addEventListener('keydown', function(e){
    if(e.key==='Enter') document.getElementById('btnSetup').click();
  });

  document.getElementById('btnSwitchUser').addEventListener('click', async function(){
    currentUser = null;
    await storeDelete('session');
    document.getElementById('whoamiBox').style.display='none';
    document.getElementById('preparedBy').value='';
    document.getElementById('loginOverlay').style.display='flex';
    document.getElementById('loginPane').style.display='block';
    document.getElementById('setupPane').style.display='none';
    populateLoginNames();
  });

  // ---------- Staff & Access tab rendering (manager only) ----------
  function renderStaffTable(){
    var wrap = document.getElementById('staffTable');
    var html = '<tr><th>Name</th><th>Role</th><th>PIN</th><th></th></tr>';
    staffDirectory.forEach(function(s){
      html += '<tr>'+
        '<td>'+escapeHtml(s.name)+'</td>'+
        '<td><span class="pill '+(s.role==='manager'?'green':'grey')+'">'+(s.role==='manager'?'Manager':'Staff')+'</span></td>'+
        '<td>'+escapeHtml(s.pin)+'</td>'+
        '<td><button class="btn danger" data-remove-staff="'+escapeHtml(s.id)+'" style="padding:5px 10px;font-size:11.5px;">Remove</button></td>'+
        '</tr>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-remove-staff]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        if(staffDirectory.length<=1){ toast('At least one staff member must remain.'); return; }
        if(!confirm('Remove this staff member? They will no longer be able to sign in.')) return;
        staffDirectory = staffDirectory.filter(function(s){ return s.id !== btn.dataset.removeStaff; });
        await saveStaff();
        renderStaffTable();
        populateLoginNames();
        toast('Staff member removed.');
      });
    });
  }
  document.getElementById('btnAddStaff').addEventListener('click', async function(){
    var name = document.getElementById('newStaffName').value.trim();
    var pin = document.getElementById('newStaffPin').value.trim();
    var role = document.getElementById('newStaffRole').value;
    if(!name || !/^[0-9]{4,6}$/.test(pin)){ toast('Enter a name and a 4–6 digit PIN.'); return; }
    staffDirectory.push({id:'u'+Date.now(), name:name, pin:pin, role:role});
    await saveStaff();
    renderStaffTable();
    populateLoginNames();
    document.getElementById('newStaffName').value='';
    document.getElementById('newStaffPin').value='';
    toast('Staff member added: '+name);
  });

  // =====================================================================
  // QUALIFICATION / CURRICULUM REFERENCE (SAQA-sourced, with honest gaps)
  // =====================================================================
  // Declared here (ahead of QUALS/tabs/etc.) because the qualification
  // select's initial change-dispatch below runs calcAll() -> renderBreakdown()
  // -> renderApprovalPanel() synchronously during script load, and that chain
  // reads currentApproval.
  var currentApproval = {status:'none', by:'', date:'', comment:''};

  var QUALS = {
    cfa:   {name:'Clearing and Forwarding Agent', nqf:5, saqa:'96368',  credits:120, verified:true,
            training:22, assessment:5, moderation:2, revision:3,
            note:'SAQA 96368 · NQF 5 · 120 credits (1,200 notional hours).'},
    scp:   {name:'Supply Chain Practitioner', nqf:5, saqa:'111445', credits:180, verified:true,
            training:32, assessment:6, moderation:3, revision:4,
            note:'SAQA 111445 · NQF 5 · 180 credits (1,800 notional hours). Note: this qualification has multiple registered versions cited between 180–189 credits — confirm the exact SAQA ID Tiespro is accredited against.'},
    tc:    {name:'Transport Clerk', nqf:4, saqa:'—', credits:121, verified:true,
            training:22, assessment:5, moderation:2, revision:3,
            note:'NQF 4 · 121 credits (1,210 notional hours). SAQA ID not confirmed from public sources — verify against Tiespro’s TETA registration.'},
    fh:    {name:'Freight Handler', nqf:3, saqa:'96396', credits:122, verified:true,
            training:18, assessment:4, moderation:2, revision:2,
            note:'SAQA 96396 · NQF 3 · 122 credits (1,220 notional hours).'},
    td:    {name:'Truck Driver', nqf:3, saqa:'—', credits:130, verified:true,
            training:20, assessment:5, moderation:2, revision:3,
            note:'NQF 3 · 130 credits (1,300 notional hours). SAQA ID not confirmed from public sources — verify against Tiespro’s TETA registration.'},
    bd:    {name:'Bus Driver', nqf:3, saqa:'94202', credits:120, verified:true,
            training:18, assessment:4, moderation:2, revision:2,
            note:'SAQA 94202 · NQF 3 · 120 credits (1,200 notional hours).'},
    txd:   {name:'Taxi Driver', nqf:3, saqa:'—', credits:null, verified:false,
            training:15, assessment:3, moderation:1, revision:2,
            note:'Credit basis could not be confirmed from public SAQA/QCTO sources at the time this tool was built. Days shown are an estimate only — confirm against Tiespro’s registered learning programme before quoting.'},
    custom:{name:'Other / Custom Programme', nqf:'', saqa:'', credits:null, verified:false,
            training:0, assessment:0, moderation:0, revision:0,
            note:'Enter days manually based on the specific programme’s curriculum.'}
  };

  function renderCurriculumRefTable(){
    var wrap = document.getElementById('curriculumRefTable');
    var html = '<tr><th>Qualification</th><th>NQF</th><th>SAQA ID</th><th>Credits</th><th>Suggested Days (T/A/M/Rev)</th></tr>';
    Object.keys(QUALS).filter(function(k){return k!=='custom';}).forEach(function(k){
      var q = QUALS[k];
      html += '<tr>'+
        '<td>'+escapeHtml(q.name)+(q.verified?'':' <span class="pill amber">Unverified</span>')+'</td>'+
        '<td>'+escapeHtml(q.nqf)+'</td>'+
        '<td>'+escapeHtml(q.saqa)+'</td>'+
        '<td>'+(q.credits||'—')+'</td>'+
        '<td>'+q.training+' / '+q.assessment+' / '+q.moderation+' / '+q.revision+'</td>'+
        '</tr>';
    });
    wrap.innerHTML = html;
  }

  // ---------- Tabs ----------
  var tabBtns = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  function visibleTabBtns(){
    return tabBtns.filter(function(b){ return !b.classList.contains('hidden-role'); });
  }
  function switchTab(targetTab){
    var targetBtn = document.querySelector('.tab-btn[data-tab="'+targetTab+'"]');
    if(!targetBtn || targetBtn.classList.contains('hidden-role')) return;
    tabBtns.forEach(function(b){
      b.classList.remove('active');
      b.setAttribute('aria-selected','false');
      b.setAttribute('tabindex','-1');
    });
    document.querySelectorAll('.tabpanel').forEach(function(p){p.classList.remove('active');});
    targetBtn.classList.add('active');
    targetBtn.setAttribute('aria-selected','true');
    targetBtn.removeAttribute('tabindex');
    document.getElementById('tab-'+targetTab).classList.add('active');
    if(targetTab==='saved') renderSavedList();
    targetBtn.focus();
  }
  tabBtns.forEach(function(btn){
    btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
    btn.addEventListener('keydown', function(e){
      var vis = visibleTabBtns();
      var idx = vis.indexOf(btn);
      if(idx === -1) return;
      if(e.key==='ArrowRight' || e.key==='ArrowDown'){
        e.preventDefault(); switchTab(vis[(idx+1)%vis.length].dataset.tab);
      } else if(e.key==='ArrowLeft' || e.key==='ArrowUp'){
        e.preventDefault(); switchTab(vis[(idx-1+vis.length)%vis.length].dataset.tab);
      } else if(e.key==='Home'){
        e.preventDefault(); switchTab(vis[0].dataset.tab);
      } else if(e.key==='End'){
        e.preventDefault(); switchTab(vis[vis.length-1].dataset.tab);
      }
    });
  });

  // ---------- Keyboard shortcuts ----------
  document.addEventListener('keydown', function(e){
    if(e.ctrlKey || e.metaKey){
      if(e.key.toLowerCase()==='s'){
        e.preventDefault();
        document.getElementById('btnSave').click();
      } else if(e.key.toLowerCase()==='p'){
        e.preventDefault();
        document.getElementById('btnGenerate').click();
      } else if(e.key==='1'){
        e.preventDefault(); switchTab('build');
      } else if(e.key==='2'){
        e.preventDefault(); switchTab('saved');
      } else if(e.key==='3'){
        e.preventDefault(); switchTab('assumptions');
      } else if(e.key==='4'){
        e.preventDefault(); switchTab('access');
      } else if(e.key==='5'){
        e.preventDefault(); switchTab('help');
      }
    }
  });

  // Clamp numeric inputs to their min/max attributes so manual entry can't break the model.
  function clampNumberInput(el){
    var val = parseFloat(el.value);
    var min = el.min === '' ? null : parseFloat(el.min);
    var max = el.max === '' ? null : parseFloat(el.max);
    var fallback = (min !== null && !isNaN(min)) ? min : 0;
    if(isNaN(val)){ el.value = fallback; }
    else {
      if(min !== null && !isNaN(min) && val < min) el.value = min;
      if(max !== null && !isNaN(max) && val > max) el.value = max;
    }
  }

  // Mark required fields as invalid when they are empty or below minimums.
  // Errors are only *displayed* for a field once the user has left it (blur)
  // or attempted to generate a quote - otherwise every field would show red
  // on a completely fresh, untouched page load.
  var REQUIRED_CHECKS = [
    {id:'clientName', test:function(v){return v.trim().length>0;}},
    {id:'quoteRef', test:function(v){return v.trim().length>0;}},
    {id:'quoteDate', test:function(v){return v.length>0;}},
    {id:'numLearners', test:function(v){return parseFloat(v)>=1;}},
    {id:'travellers', test:function(v){return parseFloat(v)>=1;}}
  ];
  var touchedFields = {};
  var revealAllErrors = false;

  function validateQuote(reveal){
    if(reveal) revealAllErrors = true;
    var valid = true;
    REQUIRED_CHECKS.forEach(function(c){
      var el = document.getElementById(c.id);
      var err = document.getElementById('err-'+c.id);
      var ok = c.test(el.value);
      var show = !!((revealAllErrors || touchedFields[c.id]) && !ok);
      el.classList.toggle('invalid', show);
      if(err) err.style.display = show ? 'block' : 'none';
      if(!ok) valid = false;
    });
    return valid;
  }
  REQUIRED_CHECKS.forEach(function(c){
    document.getElementById(c.id).addEventListener('blur', function(){
      touchedFields[c.id] = true;
      validateQuote();
    });
  });

  // ---------- Discount slider (declared early: referenced by calcAll, which other setup below triggers immediately) ----------
  var discountSlider = document.getElementById('discountSlider');
  discountSlider.addEventListener('input', function(){
    document.getElementById('discountVal').textContent = discountSlider.value + '%';
    calcAll();
  });

  // ---------- Quote reference & date defaults ----------
  var qRef = document.getElementById('quoteRef');
  var qDate = document.getElementById('quoteDate');
  function genRef(){
    var d=new Date();
    return 'TQ-'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+Math.floor(Math.random()*90+10);
  }
  qRef.value = genRef();
  qDate.value = todayISO();
  qRef.addEventListener('change', refreshCurrentApproval);

  // ---------- Qualification select prefill ----------
  var qualSel = document.getElementById('qualification');
  qualSel.addEventListener('change', function(){
    var q = QUALS[qualSel.value] || QUALS.custom;
    document.getElementById('nqfLevel').value = q.nqf || '';
    document.getElementById('trainingDays').value = q.training;
    document.getElementById('assessmentDays').value = q.assessment;
    document.getElementById('moderationDays').value = q.moderation;
    document.getElementById('revisionDays').value = q.revision;
    document.getElementById('qualRefNote').innerHTML = '<b>Curriculum basis:</b> ' + escapeHtml(q.note);
    calcAll();
  });
  qualSel.dispatchEvent(new Event('change'));

  // ---------- Delivery radio logic ----------
  var deliveryRadios = document.querySelectorAll('input[name="delivery"]');
  var accomFields = document.getElementById('accomFields');
  var travelFields = document.getElementById('travelFields');
  function updateDeliveryUI(){
    var val = document.querySelector('input[name="delivery"]:checked').value;
    document.querySelectorAll('#deliveryGroup label').forEach(function(l){l.classList.remove('selected');});
    document.querySelector('input[name="delivery"]:checked').closest('label').classList.add('selected');
    if(val==='centre'){
      travelFields.style.display='none';
    } else {
      travelFields.style.display='block';
      accomFields.style.display = (val==='remote') ? 'grid' : 'none';
    }
    calcAll();
  }
  deliveryRadios.forEach(function(r){ r.addEventListener('change', updateDeliveryUI); });
  updateDeliveryUI();

  // ---------- Assumptions persistence ----------
  var assumptionIds = ['rFacilitator','rAssessor','rModerator','rExternalMod','rInvigilation','rKm','rAccom','rSubsistence','rVenue',
    'rMaterials','rPPE','rRegistration','rEISA','rCert','rInsurance','rContingency','rFinancing','rCompliance','rOverhead','rTargetMargin','rMinMargin','rVAT'];
  var defaultAssumptions = {};
  assumptionIds.forEach(function(id){ defaultAssumptions[id] = document.getElementById(id).value; });

  async function loadAssumptions(){
    var saved = await storeGet('tiespro_assumptions');
    if(saved){
      try{
        var obj = JSON.parse(saved);
        assumptionIds.forEach(function(id){ if(obj[id]!==undefined) document.getElementById(id).value = obj[id]; });
      }catch(e){}
    }
    calcAll();
  }
  document.getElementById('btnSaveAssumptions').addEventListener('click', async function(){
    var obj = {};
    assumptionIds.forEach(function(id){ obj[id]=document.getElementById(id).value; });
    await storeSet('tiespro_assumptions', JSON.stringify(obj));
    toast('Default assumptions saved for all future quotes.');
    calcAll();
  });
  document.getElementById('btnResetAssumptions').addEventListener('click', function(){
    assumptionIds.forEach(function(id){ document.getElementById(id).value = defaultAssumptions[id]; });
    calcAll();
    toast('Assumptions reset to suggested defaults (not yet saved).');
  });

  assumptionIds.forEach(function(id){ document.getElementById(id).addEventListener('input', calcAll); });

  // ---------- Build-quote field listeners ----------
  ['clientName','quoteRef','preparedBy','quoteDate','nqfLevel','numLearners','trainingDays','assessmentDays','moderationDays','revisionDays',
   'durationMonths','distanceKm','numTrips','travellers','nights','personDaysAway'].forEach(function(id){
    document.getElementById(id).addEventListener('input', calcAll);
  });
  ['eisaRequired','externalMod','ppeRequired','venueRequired'].forEach(function(id){
    document.getElementById(id).addEventListener('change', calcAll);
  });

  // Clamp numeric inputs on blur so negative or out-of-range values can't silently corrupt the quote.
  document.querySelectorAll('input[type=number]').forEach(function(input){
    input.addEventListener('change', function(){
      clampNumberInput(input);
      calcAll();
    });
  });

  // =====================================================================
  // CORE CALCULATION
  // =====================================================================
  var lastCalc = {};

  function calcAll(){
    var v = function(id){ return parseFloat(document.getElementById(id).value) || 0; };

    var numLearners = v('numLearners');
    var trainingDays = v('trainingDays');
    var assessmentDays = v('assessmentDays');
    var moderationDays = v('moderationDays');
    var revisionDays = v('revisionDays');
    var delivery = document.querySelector('input[name="delivery"]:checked').value;
    var eisaOn = document.getElementById('eisaRequired').checked;
    var externalModOn = document.getElementById('externalMod').checked;
    var ppeOn = document.getElementById('ppeRequired').checked;
    var venueOn = document.getElementById('venueRequired').checked;

    var rFacilitator=v('rFacilitator'), rAssessor=v('rAssessor'), rModerator=v('rModerator'),
        rExternalMod=v('rExternalMod'), rInvigilation=v('rInvigilation'),
        rKm=v('rKm'), rAccom=v('rAccom'), rSubsistence=v('rSubsistence'), rVenue=v('rVenue'),
        rMaterials=v('rMaterials'), rPPE=v('rPPE'), rRegistration=v('rRegistration'), rEISA=v('rEISA'),
        rCert=v('rCert'), rInsurance=v('rInsurance'),
        rContingency=v('rContingency'), rFinancing=v('rFinancing'), rCompliance=v('rCompliance'),
        rOverhead=v('rOverhead'), rTargetMargin=v('rTargetMargin'), rMinMargin=v('rMinMargin'), rVAT=v('rVAT');

    // People costs (standard programme)
    var costFacilitator = rFacilitator * trainingDays;
    var costAssessor = rAssessor * assessmentDays;
    var costModerator = rModerator * moderationDays;
    var costExternalMod = externalModOn ? rExternalMod : 0;
    var costInvigilation = eisaOn ? rInvigilation : 0;
    var peopleTotal = costFacilitator + costAssessor + costModerator + costExternalMod + costInvigilation;

    // Travel & logistics
    var distanceKm = v('distanceKm'), numTrips = v('numTrips'), travellers = v('travellers'),
        nights = v('nights'), personDaysAway = v('personDaysAway');
    var costTravel = 0, costAccom = 0, costSubsistence = 0, costVenue = 0;
    if(delivery !== 'centre'){
      costTravel = distanceKm * 2 * rKm * numTrips * travellers;
      if(delivery === 'remote'){
        costAccom = nights * rAccom * travellers;
        costSubsistence = personDaysAway * rSubsistence;
      }
    }
    if(venueOn){
      costVenue = rVenue * (trainingDays + assessmentDays);
    }
    var logisticsTotal = costTravel + costAccom + costSubsistence + costVenue;

    // Per-learner costs
    var costMaterials = rMaterials * numLearners;
    var costPPE = ppeOn ? (rPPE * numLearners) : 0;
    var costRegistration = rRegistration * numLearners;
    var costEISAfees = eisaOn ? (rEISA * numLearners) : 0;
    var costCert = rCert * numLearners;
    var costInsurance = rInsurance * numLearners;
    var learnerTotal = costMaterials + costPPE + costRegistration + costEISAfees + costCert + costInsurance;

    var subtotalDirect = peopleTotal + logisticsTotal + learnerTotal;

    // Hidden/consequential buffers (standard programme)
    var contingencyAmt = subtotalDirect * (rContingency/100);
    var financingAmt = subtotalDirect * (rFinancing/100);
    var complianceAmt = subtotalDirect * (rCompliance/100);
    var hiddenTotal = contingencyAmt + financingAmt + complianceAmt;

    var costPlusHidden = subtotalDirect + hiddenTotal;

    // Overhead
    var overheadAmt = costPlusHidden * (rOverhead/100);
    var fullyLoadedCost = costPlusHidden + overheadAmt;

    // List price from target margin
    var marginFrac = Math.min(0.95, Math.max(0, rTargetMargin/100));
    var listPrice = fullyLoadedCost / (1 - marginFrac);

    // Discount (standard programme only)
    var discountPct = parseFloat(discountSlider.value);
    var finalStandardPrice = listPrice * (1 - discountPct/100);
    var marginAtDiscount = finalStandardPrice > 0 ? (finalStandardPrice - fullyLoadedCost) / finalStandardPrice : 0;

    // Max discount that still hits the minimum margin floor
    var minMarginFrac = rMinMargin/100;
    var priceAtFloor = fullyLoadedCost / (1 - minMarginFrac);
    var maxDiscountAtFloor = listPrice > 0 ? (1 - priceAtFloor/listPrice) * 100 : 0;

    // ---- Revision days: additional line, priced at target margin, never discounted ----
    var revisionDirect = rFacilitator * revisionDays;
    var revisionHidden = revisionDirect * ((rContingency+rFinancing+rCompliance)/100);
    var revisionCostPlusHidden = revisionDirect + revisionHidden;
    var revisionOverhead = revisionCostPlusHidden * (rOverhead/100);
    var revisionFullyLoaded = revisionCostPlusHidden + revisionOverhead;
    var revisionListPrice = revisionDays > 0 ? (revisionFullyLoaded / (1 - marginFrac)) : 0;

    var finalPrice = finalStandardPrice + revisionListPrice;
    var totalFullyLoaded = fullyLoadedCost + revisionFullyLoaded;
    var blendedMarginPct = finalPrice > 0 ? ((finalPrice - totalFullyLoaded) / finalPrice) * 100 : 0;

    // ---- Manager-approval requirement ----
    var marginPct = marginAtDiscount * 100;
    var isLoss = marginPct < 0;
    var approvalRequired = !isLoss && (marginPct < rMinMargin || discountPct > 15);

    lastCalc = {
      numLearners: numLearners, delivery: delivery, eisaOn: eisaOn,
      peopleTotal: peopleTotal, costFacilitator: costFacilitator, costAssessor: costAssessor, costModerator: costModerator,
      costExternalMod: costExternalMod, costInvigilation: costInvigilation,
      logisticsTotal: logisticsTotal, costTravel: costTravel, costAccom: costAccom, costSubsistence: costSubsistence, costVenue: costVenue,
      learnerTotal: learnerTotal, costMaterials: costMaterials, costPPE: costPPE, costRegistration: costRegistration,
      costEISAfees: costEISAfees, costCert: costCert, costInsurance: costInsurance,
      subtotalDirect: subtotalDirect, contingencyAmt: contingencyAmt, financingAmt: financingAmt, complianceAmt: complianceAmt,
      hiddenTotal: hiddenTotal, overheadAmt: overheadAmt, fullyLoadedCost: fullyLoadedCost,
      listPrice: listPrice, discountPct: discountPct, finalStandardPrice: finalStandardPrice, marginAtDiscount: marginAtDiscount,
      maxDiscountAtFloor: maxDiscountAtFloor, rVAT: rVAT, rMinMargin: rMinMargin,
      trainingDays: trainingDays, assessmentDays: assessmentDays, moderationDays: moderationDays, revisionDays: revisionDays,
      revisionDirect: revisionDirect, revisionFullyLoaded: revisionFullyLoaded, revisionListPrice: revisionListPrice,
      finalPrice: finalPrice, totalFullyLoaded: totalFullyLoaded, blendedMarginPct: blendedMarginPct,
      isLoss: isLoss, approvalRequired: approvalRequired, marginPct: marginPct
    };

    validateQuote();
    renderBreakdown();
  }

  function renderBreakdown(){
    var c = lastCalc;
    var t = document.getElementById('costTable');
    var rows = [];
    function cat(label){ rows.push('<tr class="category"><td colspan="2">'+label+'</td></tr>'); }
    function addoncat(label){ rows.push('<tr class="addoncat"><td colspan="2">'+label+'</td></tr>'); }
    function line(label, amt){ rows.push('<tr><td>'+label+'</td><td class="amt">'+fmtR(amt)+'</td></tr>'); }

    cat('Facilitation, Assessment &amp; Moderation');
    line('Facilitator ('+c.trainingDays+' days)', c.costFacilitator);
    line('Assessor ('+c.assessmentDays+' days)', c.costAssessor);
    line('Internal moderator ('+c.moderationDays+' days)', c.costModerator);
    if(c.costExternalMod) line('External moderation fee', c.costExternalMod);
    if(c.costInvigilation) line('EISA invigilation', c.costInvigilation);

    cat('Travel, Accommodation &amp; Venue');
    line('Travel (km-based)', c.costTravel);
    line('Accommodation', c.costAccom);
    line('Subsistence', c.costSubsistence);
    line('Venue hire', c.costVenue);

    cat('Per-Learner Materials &amp; Compliance ('+c.numLearners+' learners)');
    line('Materials / workbooks', c.costMaterials);
    line('PPE / consumables', c.costPPE);
    line('SETA/QCTO registration &amp; admin', c.costRegistration);
    if(c.costEISAfees) line('EISA registration fees', c.costEISAfees);
    line('Certification issuing', c.costCert);
    line('Learner insurance / liability cover', c.costInsurance);

    rows.push('<tr class="total"><td>Subtotal Direct Cost</td><td class="amt">'+fmtR(c.subtotalDirect)+'</td></tr>');

    cat('Hidden &amp; Consequential Cost Buffers');
    line('Contingency (no-shows, re-assessments, delays)', c.contingencyAmt);
    line('Cost-of-capital / cash-flow financing', c.financingAmt);
    line('Compliance &amp; accreditation overhead', c.complianceAmt);
    line('Company overhead allocation', c.overheadAmt);

    rows.push('<tr class="total"><td>Fully Loaded Cost (standard programme)</td><td class="amt">'+fmtR(c.fullyLoadedCost)+'</td></tr>');
    rows.push('<tr class="sub"><td>List Price at target margin (before discount)</td><td class="amt">'+fmtR(c.listPrice)+'</td></tr>');
    rows.push('<tr class="sub"><td>Standard programme price after discount</td><td class="amt">'+fmtR(c.finalStandardPrice)+'</td></tr>');

    if(c.revisionDays > 0){
      addoncat('Additional: Revision Days (not discounted)');
      line('Facilitator revision days ('+c.revisionDays+' days, at target margin)', c.revisionListPrice);
    }

    rows.push('<tr class="grandtotal"><td>Total Quoted Price (excl. VAT)</td><td class="amt">'+fmtR(c.finalPrice)+'</td></tr>');

    t.innerHTML = rows.join('');

    document.getElementById('discountVal').textContent = c.discountPct + '%';
    document.getElementById('marginAtDiscount').textContent = 'Standard programme margin: ' + c.marginPct.toFixed(1) + '%';

    document.getElementById('finalPrice').textContent = fmtR(c.finalPrice);
    var perLearner = c.numLearners>0 ? c.finalPrice/c.numLearners : 0;
    document.getElementById('perLearnerPrice').textContent = fmtR(perLearner) + ' per learner · excl. VAT (' + c.rVAT + '% VAT = ' + fmtR(c.finalPrice*c.rVAT/100) + ') · blended margin ' + c.blendedMarginPct.toFixed(1) + '%';

    var ind = document.getElementById('marginIndicator');
    if(c.isLoss){
      ind.className='indicator red';
      ind.innerHTML='<span class="dot"></span> Loss-making at '+c.marginPct.toFixed(1)+'% margin. Do not send this quote — reduce discount or revise scope.';
    } else if(c.marginPct < c.rMinMargin || c.discountPct > 15){
      ind.className='indicator amber';
      ind.innerHTML='<span class="dot"></span> '+c.marginPct.toFixed(1)+'% margin at '+c.discountPct+'% discount. Maximum discount to stay at the '+c.rMinMargin+'% floor is '+Math.max(0,c.maxDiscountAtFloor).toFixed(1)+'%. Manager approval required before sending.';
    } else {
      ind.className='indicator green';
      ind.innerHTML='<span class="dot"></span> Healthy margin: '+c.marginPct.toFixed(1)+'% — at or above your '+c.rMinMargin+'% floor. Safe to quote.';
    }

    renderApprovalPanel();
  }

  // =====================================================================
  // MANAGER APPROVAL WORKFLOW
  // =====================================================================
  // (currentApproval itself is declared earlier, before QUALS, since the
  // qualification select's initial change-dispatch triggers calcAll() ->
  // renderBreakdown() -> renderApprovalPanel() synchronously at script load,
  // before this point in the file would otherwise have run.)

  async function refreshCurrentApproval(){
    var ref = qRef.value.trim();
    if(!ref){ currentApproval = {status:'none', by:'', date:'', comment:''}; renderApprovalPanel(); return; }
    var val = await storeGet('quote:'+ref);
    if(val){
      try{
        var r = JSON.parse(val);
        currentApproval = {status:r.approvalStatus||'none', by:r.approvedBy||'', date:r.approvalDate||'', comment:r.approvalComment||''};
      }catch(e){ currentApproval = {status:'none', by:'', date:'', comment:''}; }
    } else {
      currentApproval = {status:'none', by:'', date:'', comment:''};
    }
    renderApprovalPanel();
  }

  function renderApprovalPanel(){
    var c = lastCalc;
    var panel = document.getElementById('approvalPanel');
    var genBtn = document.getElementById('btnGenerate');
    if(!c.approvalRequired || c.isLoss){
      panel.innerHTML='';
      genBtn.disabled = !!c.isLoss;
      genBtn.title = c.isLoss ? 'Loss-making quote — reprice before generating.' : '';
      return;
    }
    if(currentApproval.status === 'approved'){
      panel.innerHTML = '<div class="approvalbox approved"><b>Approved</b> by '+escapeHtml(currentApproval.by)+' on '+escapeHtml(currentApproval.date)+'. '+(currentApproval.comment?('Comment: '+escapeHtml(currentApproval.comment)):'')+'</div>';
      genBtn.disabled = false; genBtn.title='';
      return;
    }
    if(currentApproval.status === 'rejected'){
      panel.innerHTML = '<div class="approvalbox rejected"><b>Rejected</b> by '+escapeHtml(currentApproval.by)+' on '+escapeHtml(currentApproval.date)+'. Comment: '+escapeHtml(currentApproval.comment||'—')+'. Revise the quote and submit again.</div>';
      genBtn.disabled = true; genBtn.title='This quote was rejected — revise and resubmit for approval.';
      return;
    }
    if(currentApproval.status === 'pending'){
      var mgrControls = (currentUser && currentUser.role==='manager') ?
        '<textarea id="approvalCommentInput" placeholder="Optional comment"></textarea>'+
        '<div class="btnrow"><button class="btn approve" id="btnApproveNow" type="button">Approve</button><button class="btn danger" id="btnRejectNow" type="button">Reject</button></div>' :
        '<div style="margin-top:6px;">Waiting for a manager to review in the Quote Tracker.</div>';
      panel.innerHTML = '<div class="approvalbox pending"><b>Pending manager approval</b> — this discount/margin needs sign-off before the quote can be generated.'+mgrControls+'</div>';
      genBtn.disabled = true; genBtn.title='Awaiting manager approval.';
      bindApprovalActions();
      return;
    }
    panel.innerHTML = '<div class="approvalbox pending"><b>Manager approval required</b> for this discount/margin. Save the quote, then click "Submit for Manager Approval" below.</div>'+
      '<div class="btnrow"><button class="btn ghost" id="btnSubmitApproval" type="button">Submit for Manager Approval</button></div>';
    genBtn.disabled = true; genBtn.title='Submit for manager approval first.';
    var submitBtn = document.getElementById('btnSubmitApproval');
    if(submitBtn) submitBtn.addEventListener('click', async function(){
      var r = await saveCurrentQuote({approvalStatus:'pending'});
      if(!r) return;
      await refreshCurrentApproval();
      toast('Submitted for manager approval.');
    });
  }

  function bindApprovalActions(){
    var appBtn = document.getElementById('btnApproveNow');
    var rejBtn = document.getElementById('btnRejectNow');
    if(appBtn) appBtn.addEventListener('click', async function(){
      var comment = document.getElementById('approvalCommentInput').value;
      await saveCurrentQuote({approvalStatus:'approved', approvedBy:currentUser.name, approvalDate:todayISO(), approvalComment:comment});
      await refreshCurrentApproval();
      toast('Quote approved.');
    });
    if(rejBtn) rejBtn.addEventListener('click', async function(){
      var comment = document.getElementById('approvalCommentInput').value;
      if(!comment){ alert('Please add a comment explaining the rejection.'); return; }
      await saveCurrentQuote({approvalStatus:'rejected', approvedBy:currentUser.name, approvalDate:todayISO(), approvalComment:comment});
      await refreshCurrentApproval();
      toast('Quote rejected.');
    });
  }

  // =====================================================================
  // SAVE / LOAD / TRACK QUOTES
  // =====================================================================
  function buildRecord(){
    var ref = document.getElementById('quoteRef').value.trim() || genRef();
    var q = QUALS[qualSel.value] || QUALS.custom;
    return {
      id: 'quote:'+ref,
      quoteRef: ref,
      clientName: document.getElementById('clientName').value || 'Unnamed client',
      preparedBy: document.getElementById('preparedBy').value,
      quoteDate: document.getElementById('quoteDate').value,
      qualification: qualSel.value,
      qualificationName: q.name,
      nqfLevel: document.getElementById('nqfLevel').value,
      numLearners: document.getElementById('numLearners').value,
      trainingDays: document.getElementById('trainingDays').value,
      assessmentDays: document.getElementById('assessmentDays').value,
      moderationDays: document.getElementById('moderationDays').value,
      revisionDays: document.getElementById('revisionDays').value,
      durationMonths: document.getElementById('durationMonths').value,
      eisaRequired: document.getElementById('eisaRequired').checked,
      externalMod: document.getElementById('externalMod').checked,
      ppeRequired: document.getElementById('ppeRequired').checked,
      venueRequired: document.getElementById('venueRequired').checked,
      delivery: document.querySelector('input[name="delivery"]:checked').value,
      distanceKm: document.getElementById('distanceKm').value,
      numTrips: document.getElementById('numTrips').value,
      travellers: document.getElementById('travellers').value,
      nights: document.getElementById('nights').value,
      personDaysAway: document.getElementById('personDaysAway').value,
      discountPct: discountSlider.value,
      finalPrice: lastCalc.finalPrice,
      fullyLoadedCost: lastCalc.totalFullyLoaded,
      marginAtDiscount: lastCalc.blendedMarginPct/100,
      approvalRequired: lastCalc.approvalRequired,
      approvalStatus: currentApproval.status,
      approvedBy: currentApproval.by,
      approvalDate: currentApproval.date,
      approvalComment: currentApproval.comment,
      pipelineStatus: 'draft',
      sentDate: '',
      followUpDate: '',
      activityLog: [],
      savedAt: new Date().toISOString()
    };
  }

  async function saveCurrentQuote(overrides){
    if(!validateQuote(true)){
      toast('Please fix the highlighted fields before saving.');
      return null;
    }
    var ref = document.getElementById('quoteRef').value.trim();
    var key = 'quote:'+ref;
    var existingRaw = await storeGet(key);
    var existing = null;
    if(existingRaw){ try{ existing = JSON.parse(existingRaw); }catch(e){} }
    var record = buildRecord();
    if(existing){
      record.pipelineStatus = existing.pipelineStatus || 'draft';
      record.sentDate = existing.sentDate || '';
      record.followUpDate = existing.followUpDate || '';
      record.activityLog = existing.activityLog || [];
      if(!overrides || !overrides.approvalStatus){
        record.approvalStatus = existing.approvalStatus || 'none';
        record.approvedBy = existing.approvedBy || '';
        record.approvalDate = existing.approvalDate || '';
        record.approvalComment = existing.approvalComment || '';
      }
    }
    if(overrides) Object.assign(record, overrides);
    if(overrides && overrides.approvalStatus){
      record.activityLog.push({date:new Date().toISOString(), user:(currentUser?currentUser.name:'Unknown'), note:'Approval status set to '+overrides.approvalStatus+(overrides.approvalComment?(' — '+overrides.approvalComment):'')});
    }
    await storeSet(key, JSON.stringify(record));
    return record;
  }

  document.getElementById('btnSave').addEventListener('click', async function(){
    var r = await saveCurrentQuote();
    if(r){ toast('Quote saved: '+r.quoteRef); clearDirty(); await refreshCurrentApproval(); }
  });

  // ---------- Quote Tracker rendering ----------
  async function renderSavedList(){
    var keys = await storeListKeys('quote:');
    var wrap = document.getElementById('savedListWrap');
    var statsWrap = document.getElementById('trackerStats');
    var search = (document.getElementById('savedSearch').value || '').toLowerCase();
    if(!keys || keys.length===0){
      wrap.innerHTML = '<div class="emptystate">No quotes saved yet — build a quote and click "Save Quote".</div>';
      statsWrap.innerHTML = '';
      return;
    }
    var records = [];
    for(var i=0;i<keys.length;i++){
      var val = await storeGet(keys[i]);
      if(val){ try{ records.push(JSON.parse(val)); }catch(e){} }
    }
    records.sort(function(a,b){ return new Date(b.savedAt) - new Date(a.savedAt); });

    var today = todayISO();
    var pendingCount=0, overdueCount=0, sentCount=0, wonCount=0, lostCount=0;
    records.forEach(function(r){
      if(r.approvalStatus==='pending') pendingCount++;
      if(r.pipelineStatus==='sent' || r.pipelineStatus==='follow_up_due'){
        sentCount++;
        if(r.followUpDate && r.followUpDate < today) overdueCount++;
      }
      if(r.pipelineStatus==='won') wonCount++;
      if(r.pipelineStatus==='lost') lostCount++;
    });
    statsWrap.innerHTML =
      '<div class="statchip"><div class="n">'+records.length+'</div><div class="l">Total Quotes</div></div>'+
      '<div class="statchip'+(pendingCount?' warn':'')+'"><div class="n">'+pendingCount+'</div><div class="l">Pending Approval</div></div>'+
      '<div class="statchip"><div class="n">'+sentCount+'</div><div class="l">Sent / Awaiting</div></div>'+
      '<div class="statchip'+(overdueCount?' warn':'')+'"><div class="n">'+overdueCount+'</div><div class="l">Follow-up Overdue</div></div>'+
      '<div class="statchip"><div class="n">'+wonCount+'</div><div class="l">Won</div></div>'+
      '<div class="statchip"><div class="n">'+lostCount+'</div><div class="l">Lost</div></div>';

    if(search){
      records = records.filter(function(r){
        return (r.clientName||'').toLowerCase().indexOf(search)>-1 || (r.quoteRef||'').toLowerCase().indexOf(search)>-1;
      });
    }
    if(records.length===0){
      wrap.innerHTML = '<div class="emptystate">No quotes match your search.</div>';
      return;
    }

    var html = '<div style="overflow-x:auto;"><table class="savedlist"><tr><th>Quote Ref</th><th>Client</th><th>Prepared By</th><th>Price</th><th>Margin</th><th>Approval</th><th>Pipeline</th><th>Follow-up</th><th>Actions</th></tr>';
    records.forEach(function(r){
      var marginPct = (r.marginAtDiscount*100);
      var pillClass = marginPct >= 20 ? 'green' : (marginPct>=0 ? 'amber':'red');
      var apPill = {none:'grey', pending:'amber', approved:'green', rejected:'red'}[r.approvalStatus||'none'];
      var apLabel = {none:'—', pending:'Pending', approved:'Approved', rejected:'Rejected'}[r.approvalStatus||'none'];
      var pipelineStatus = r.pipelineStatus || 'draft';
      var overdue = r.followUpDate && r.followUpDate < today && (pipelineStatus==='sent'||pipelineStatus==='follow_up_due');

      var statusOptions = ['draft','sent','follow_up_due','won','lost'].map(function(s){
        var labels = {draft:'Draft',sent:'Sent',follow_up_due:'Follow-up Due',won:'Won',lost:'Lost'};
        return '<option value="'+s+'"'+(pipelineStatus===s?' selected':'')+'>'+labels[s]+'</option>';
      }).join('');

      var canApprove = currentUser && currentUser.role==='manager' && r.approvalStatus==='pending';

      html += '<tr class="'+(overdue?'overdue':'')+'">'+
        '<td>'+escapeHtml(r.quoteRef)+'</td>'+
        '<td>'+escapeHtml(r.clientName)+'</td>'+
        '<td>'+escapeHtml(r.preparedBy||'—')+'</td>'+
        '<td>'+fmtR(r.finalPrice)+'</td>'+
        '<td><span class="pill '+pillClass+'">'+marginPct.toFixed(1)+'%</span></td>'+
        '<td><span class="pill '+apPill+'">'+apLabel+'</span>'+(canApprove?' <button class="btn approve" data-quickapprove="'+escapeHtml(r.id)+'" style="padding:3px 8px;font-size:10.5px;margin-top:4px;">Approve</button>':'')+'</td>'+
        '<td><select data-status="'+escapeHtml(r.id)+'">'+statusOptions+'</select></td>'+
        '<td><input type="date" data-followup="'+escapeHtml(r.id)+'" value="'+escapeHtml(r.followUpDate||'')+'"></td>'+
        '<td><button class="btn ghost" data-load="'+escapeHtml(r.id)+'" style="padding:5px 10px;font-size:11.5px;">Load</button> '+
        '<button class="btn ghost" data-dup="'+escapeHtml(r.id)+'" style="padding:5px 10px;font-size:11.5px;">Dup</button> '+
        '<button class="btn danger" data-del="'+escapeHtml(r.id)+'" style="padding:5px 10px;font-size:11.5px;">Del</button></td>'+
        '</tr>';
    });
    html += '</table></div>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-load]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var val = await storeGet(btn.dataset.load);
        if(val){ loadQuote(JSON.parse(val)); }
      });
    });
    wrap.querySelectorAll('[data-dup]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var val = await storeGet(btn.dataset.dup);
        if(!val) return;
        var r = JSON.parse(val);
        r.quoteRef = r.quoteRef + '-COPY';
        r.id = 'quote:'+r.quoteRef;
        r.pipelineStatus = 'draft';
        r.sentDate = ''; r.followUpDate = '';
        r.approvalStatus = 'none'; r.approvedBy=''; r.approvalDate=''; r.approvalComment='';
        r.activityLog = [];
        r.savedAt = new Date().toISOString();
        await storeSet(r.id, JSON.stringify(r));
        renderSavedList();
        toast('Quote duplicated: '+r.quoteRef);
      });
    });
    wrap.querySelectorAll('[data-del]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        if(!confirm('Delete this saved quote?')) return;
        await storeDelete(btn.dataset.del);
        renderSavedList();
        toast('Quote deleted.');
      });
    });
    wrap.querySelectorAll('[data-status]').forEach(function(sel){
      sel.addEventListener('change', async function(){
        var raw = await storeGet(sel.dataset.status);
        if(!raw) return;
        var r = JSON.parse(raw);
        r.pipelineStatus = sel.value;
        if(sel.value==='sent' && !r.sentDate) r.sentDate = todayISO();
        r.activityLog = r.activityLog || [];
        r.activityLog.push({date:new Date().toISOString(), user:(currentUser?currentUser.name:'Unknown'), note:'Pipeline status set to '+sel.value});
        await storeSet(sel.dataset.status, JSON.stringify(r));
        renderSavedList();
      });
    });
    wrap.querySelectorAll('[data-followup]').forEach(function(inp){
      inp.addEventListener('change', async function(){
        var raw = await storeGet(inp.dataset.followup);
        if(!raw) return;
        var r = JSON.parse(raw);
        r.followUpDate = inp.value;
        await storeSet(inp.dataset.followup, JSON.stringify(r));
        renderSavedList();
      });
    });
    wrap.querySelectorAll('[data-quickapprove]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var raw = await storeGet(btn.dataset.quickapprove);
        if(!raw) return;
        var r = JSON.parse(raw);
        r.approvalStatus='approved'; r.approvedBy=currentUser.name; r.approvalDate=todayISO();
        r.activityLog = r.activityLog || [];
        r.activityLog.push({date:new Date().toISOString(), user:currentUser.name, note:'Approved from Quote Tracker'});
        await storeSet(btn.dataset.quickapprove, JSON.stringify(r));
        renderSavedList();
        toast('Approved: '+r.quoteRef);
      });
    });
  }

  document.getElementById('savedSearch').addEventListener('input', renderSavedList);

  document.getElementById('btnClearAll').addEventListener('click', async function(){
    if(!confirm('Delete ALL saved quotes? This cannot be undone.')) return;
    var keys = await storeListKeys('quote:');
    for(var i=0;i<keys.length;i++){ await storeDelete(keys[i]); }
    renderSavedList();
    toast('All saved quotes cleared.');
  });

  function loadQuote(r){
    document.getElementById('clientName').value = r.clientName;
    document.getElementById('quoteRef').value = r.quoteRef;
    document.getElementById('quoteDate').value = r.quoteDate;
    if(QUALS[r.qualification]) qualSel.value = r.qualification;
    document.getElementById('nqfLevel').value = r.nqfLevel;
    document.getElementById('numLearners').value = r.numLearners;
    document.getElementById('trainingDays').value = r.trainingDays;
    document.getElementById('assessmentDays').value = r.assessmentDays;
    document.getElementById('moderationDays').value = r.moderationDays;
    document.getElementById('revisionDays').value = r.revisionDays||0;
    document.getElementById('durationMonths').value = r.durationMonths;
    document.getElementById('eisaRequired').checked = r.eisaRequired;
    document.getElementById('externalMod').checked = r.externalMod;
    document.getElementById('ppeRequired').checked = r.ppeRequired;
    document.getElementById('venueRequired').checked = r.venueRequired;
    document.querySelector('input[name="delivery"][value="'+r.delivery+'"]').checked = true;
    document.getElementById('distanceKm').value = r.distanceKm;
    document.getElementById('numTrips').value = r.numTrips;
    document.getElementById('travellers').value = r.travellers;
    document.getElementById('nights').value = r.nights;
    document.getElementById('personDaysAway').value = r.personDaysAway;
    discountSlider.value = r.discountPct;
    updateDeliveryUI();
    saveDraft();
    switchTab('build');
    refreshCurrentApproval();
    toast('Quote loaded: '+r.quoteRef);
  }

  // ---------- Export / import saved quotes ----------
  document.getElementById('btnExportQuotes').addEventListener('click', async function(){
    var keys = await storeListKeys('quote:');
    var records = [];
    for(var i=0;i<keys.length;i++){
      var val = await storeGet(keys[i]);
      if(val){ try{ records.push(JSON.parse(val)); }catch(e){} }
    }
    if(records.length===0){ toast('No saved quotes to export.'); return; }
    records.sort(function(a,b){ return new Date(b.savedAt) - new Date(a.savedAt); });
    var blob = new Blob([JSON.stringify(records, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tiespro-quotes-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Exported '+records.length+' quote(s).');
  });

  document.getElementById('btnImportQuotes').addEventListener('click', function(){
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev){
      try{
        var data = JSON.parse(ev.target.result);
        if(!Array.isArray(data)) throw new Error('File must contain an array of quote records.');
        var imported = 0, skipped = 0;
        for(var i=0;i<data.length;i++){
          var r = data[i];
          if(!r || !r.id || r.id.indexOf('quote:')!==0){ skipped++; continue; }
          // Re-serialize so any accidental extra fields are dropped and storage key is consistent.
          await storeSet(r.id, JSON.stringify(r));
          imported++;
        }
        toast('Imported '+imported+' quote(s). '+skipped+' skipped.');
        renderSavedList();
      }catch(err){
        toast('Import failed: '+err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('btnReset').addEventListener('click', function(){
    if(confirm('Clear all fields on this quote?')){
      document.getElementById('clientName').value='';
      qRef.value = genRef();
      document.getElementById('numLearners').value=20;
      qualSel.value='cfa'; qualSel.dispatchEvent(new Event('change'));
      document.getElementById('distanceKm').value=0;
      document.getElementById('numTrips').value=1;
      document.getElementById('travellers').value=1;
      document.getElementById('nights').value=0;
      document.getElementById('personDaysAway').value=0;
      discountSlider.value=0;
      document.querySelector('input[name="delivery"][value="centre"]').checked=true;
      updateDeliveryUI();
      touchedFields = {};
      revealAllErrors = false;
      currentApproval = {status:'none', by:'', date:'', comment:''};
      calcAll();
    }
  });

  // ---------- Generate client-facing printable quote ----------
  document.getElementById('btnGenerate').addEventListener('click', function(){
    if(document.getElementById('btnGenerate').disabled) return;
    if(!validateQuote(true)){
      toast('Please fix the highlighted fields before generating a quote.');
      return;
    }
    var c = lastCalc;
    var clientName = escapeHtml(document.getElementById('clientName').value) || 'Prospective Client';
    var qualText = escapeHtml(document.getElementById('qualification').selectedOptions[0].text);
    var nqf = escapeHtml(document.getElementById('nqfLevel').value);
    var ref = escapeHtml(document.getElementById('quoteRef').value);
    var date = escapeHtml(document.getElementById('quoteDate').value);
    var preparedBy = escapeHtml(document.getElementById('preparedBy').value);

    document.getElementById('pqMeta').innerHTML =
      'Quote Reference: <b>'+ref+'</b><br>Date: '+date+'<br>Prepared by: '+(preparedBy||'Tiespro Training Institute')+'<br>Valid for 30 days';

    document.getElementById('pqClientBlock').innerHTML =
      '<b>'+clientName+'</b><br>Programme: '+qualText+(nqf?(' — NQF Level '+nqf):'')+'<br>Number of learners: '+c.numLearners;

    var deliveryLabel = c.delivery==='centre' ? 'Tiespro Training Centre, Durban' : (c.delivery==='local' ? 'Client site (local delivery)' : 'Client site (delivery with overnight logistics)');
    var durationMonths = document.getElementById('durationMonths').value || '12';
    var summaryRows =
      '<tr><th>Item</th><th>Detail</th></tr>'+
      '<tr><td>Programme duration</td><td>'+escapeHtml(durationMonths)+' month'+(durationMonths==='1'?'':'s')+'</td></tr>'+
      '<tr><td>Training days</td><td>'+c.trainingDays+'</td></tr>'+
      '<tr><td>Assessment days</td><td>'+c.assessmentDays+'</td></tr>'+
      '<tr><td>Delivery location</td><td>'+deliveryLabel+'</td></tr>'+
      '<tr><td>External examination (EISA)</td><td>'+(c.eisaOn?'Included':'Not applicable')+'</td></tr>';
    if(c.revisionDays>0) summaryRows += '<tr><td>Revision days (additional)</td><td>'+c.revisionDays+'</td></tr>';
    document.getElementById('pqSummaryTable').innerHTML = summaryRows;

    var vatAmt = c.finalPrice * c.rVAT/100;
    var priceRows =
      '<tr><th>Line Item</th><th style="text-align:right;">Amount</th></tr>'+
      '<tr><td>Training Delivery (facilitation)</td><td class="amt">'+fmtR(c.costFacilitator)+'</td></tr>'+
      '<tr><td>Assessment &amp; Moderation</td><td class="amt">'+fmtR(c.costAssessor + c.costModerator + c.costExternalMod)+'</td></tr>';
    if(c.eisaOn) priceRows += '<tr><td>Examination (EISA) &amp; Invigilation</td><td class="amt">'+fmtR(c.costEISAfees + c.costInvigilation)+'</td></tr>';
    priceRows += '<tr><td>Travel &amp; Logistics</td><td class="amt">'+fmtR(c.logisticsTotal)+'</td></tr>';
    priceRows += '<tr><td>Learner Materials &amp; Compliance</td><td class="amt">'+fmtR(c.costMaterials + c.costPPE + c.costRegistration + c.costCert + c.costInsurance)+'</td></tr>';
    if(c.discountPct>0){
      priceRows += '<tr><td>Standard Programme Investment (before discount)</td><td class="amt">'+fmtR(c.listPrice)+'</td></tr>';
      priceRows += '<tr><td>Discount ('+c.discountPct+'%)</td><td class="amt">-'+fmtR(c.listPrice - c.finalStandardPrice)+'</td></tr>';
    }
    priceRows += '<tr class="total"><td>Standard Programme Total</td><td class="amt">'+fmtR(c.finalStandardPrice)+'</td></tr>';
    if(c.revisionDays>0){
      priceRows += '<tr><td>Additional: Revision Days ('+c.revisionDays+' days, not discounted)</td><td class="amt">'+fmtR(c.revisionListPrice)+'</td></tr>';
    }
    priceRows += '<tr class="total"><td>Total Investment (excl. VAT)</td><td class="amt">'+fmtR(c.finalPrice)+'</td></tr>';
    priceRows += '<tr><td>VAT ('+c.rVAT+'%)</td><td class="amt">'+fmtR(vatAmt)+'</td></tr>';
    priceRows += '<tr class="total"><td>Total Investment (incl. VAT)</td><td class="amt">'+fmtR(c.finalPrice+vatAmt)+'</td></tr>';
    priceRows += '<tr><td>Per learner (excl. VAT)</td><td class="amt">'+fmtR(c.finalPrice/(c.numLearners||1))+'</td></tr>';

    document.getElementById('pqPriceTable').innerHTML = priceRows;

    window.print();
  });

  // ---------- Unsaved-changes warning ----------
  var isDirty = false;
  function setDirty(){ isDirty = true; }
  function clearDirty(){ isDirty = false; }
  document.getElementById('tab-build').addEventListener('input', setDirty);
  document.getElementById('tab-build').addEventListener('change', setDirty);
  window.addEventListener('beforeunload', function(e){
    if(!isDirty) return;
    e.preventDefault();
    e.returnValue = 'You have unsaved changes to this quote.';
    return e.returnValue;
  });

  // ---------- Auto-save draft ----------
  var DRAFT_KEYS = ['clientName','quoteRef','preparedBy','quoteDate','qualification','nqfLevel','numLearners','trainingDays','assessmentDays','moderationDays','revisionDays','durationMonths','distanceKm','numTrips','travellers','nights','personDaysAway','discountSlider'];
  var DRAFT_CHECKBOXES = ['eisaRequired','externalMod','ppeRequired','venueRequired'];
  function saveDraft(){
    var draft = {};
    DRAFT_KEYS.forEach(function(id){ draft[id]=document.getElementById(id).value; });
    DRAFT_CHECKBOXES.forEach(function(id){ draft[id]=document.getElementById(id).checked; });
    draft.delivery = document.querySelector('input[name="delivery"]:checked').value;
    draft.savedAt = new Date().toISOString();
    storeSet('draft', JSON.stringify(draft));
  }
  async function loadDraft(){
    var raw = await storeGet('draft');
    if(!raw) return;
    try{
      var draft = JSON.parse(raw);
      DRAFT_KEYS.forEach(function(id){ if(draft[id]!==undefined && id!=='preparedBy') document.getElementById(id).value = draft[id]; });
      DRAFT_CHECKBOXES.forEach(function(id){ if(draft[id]!==undefined) document.getElementById(id).checked = draft[id]; });
      if(draft.delivery) document.querySelector('input[name="delivery"][value="'+draft.delivery+'"]').checked = true;
      updateDeliveryUI();
    }catch(e){}
  }
  document.getElementById('tab-build').addEventListener('input', function(){ saveDraft(); });
  document.getElementById('tab-build').addEventListener('change', function(){ saveDraft(); });

  // =====================================================================
  // INIT
  // =====================================================================
  async function init(){
    await loadStaff();
    renderStaffTable();
    renderCurriculumRefTable();
    await loadAssumptions();
    await loadDraft();

    // Deep-link to a tab via URL hash (e.g. tool.html#saved from a PWA shortcut)
    var hashTab = window.location.hash.replace('#','');
    if(['build','saved','assumptions','access','help'].indexOf(hashTab)>-1){
      switchTab(hashTab);
    }

    await tryAutoLogin();
  }
  init();

  // ---------- PWA: install prompt ----------
  var deferredInstallPrompt = null;
  var btnInstall = document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredInstallPrompt = e;
    btnInstall.style.display = 'inline-block';
  });
  btnInstall.addEventListener('click', async function(){
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btnInstall.style.display = 'none';
  });
  window.addEventListener('appinstalled', function(){
    btnInstall.style.display = 'none';
    toast('Tiespro Costing Tool installed.');
  });

  // ---------- PWA: service worker (offline support) ----------
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(){ /* offline install still works without SW */ });
    });
  }

  // ---------- Online / offline indicator ----------
  function updateOnlineStatus(){
    var online = navigator.onLine;
    document.getElementById('onlineDot').style.background = online ? '#1B7A43' : '#B4232C';
    document.getElementById('onlineText').textContent = online ? 'Online' : 'Offline';
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
})();
