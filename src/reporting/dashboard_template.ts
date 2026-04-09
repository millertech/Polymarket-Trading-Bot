export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PolyMarket Strategies</title>
<style>
/* ═══ Design tokens ═══ */
:root {
  --bg:       #0b0e11;
  --surface:  #151a21;
  --surface2: #1c2330;
  --border:   #1e2630;
  --text:     #e4e8ed;
  --muted:    #8892a0;
  --accent:   #4f8ff7;
  --accent2:  #6366f1;
  --green:    #00d68f;
  --red:      #ff4d6a;
  --yellow:   #ffc107;
  --orange:   #f97316;
  --purple:   #a855f7;
  --radius:   12px;
  --radius-sm:8px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}

/* ═══ Header / Nav ═══ */
.header{display:flex;align-items:center;padding:0 32px;height:60px;background:var(--surface);border-bottom:1px solid var(--border);gap:32px}
.header .logo{font-size:18px;font-weight:800;letter-spacing:-.5px;white-space:nowrap}
.header .logo span{color:var(--accent)}
.tabs{display:flex;gap:2px}
.tab-btn{background:transparent;border:none;color:var(--muted);padding:18px 20px;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;letter-spacing:.3px}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
.header-right{margin-left:auto;display:flex;align-items:center;gap:14px}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;animation:pulse-anim 2s ease-in-out infinite}
@keyframes pulse-anim{0%,100%{opacity:1}50%{opacity:.3}}
.header-ts{font-size:11px;color:var(--muted)}

/* ═══ Main container ═══ */
.main{max-width:1440px;margin:0 auto;padding:24px 32px}
.tab-pane{display:none}
.tab-pane.active{display:block}

/* ═══ Summary cards ═══ */
.summary-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:24px}
.s-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
.s-card .label{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:6px}
.s-card .value{font-size:26px;font-weight:700}
.pnl-pos{color:var(--green)}.pnl-neg{color:var(--red)}.pnl-zero{color:var(--muted)}

/* ═══ Wallet cards ═══ */
.wallet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:18px}
.w-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color .2s}
.w-card:hover{border-color:var(--accent)}
.w-hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)}
.w-hdr .w-left{display:flex;align-items:center;gap:10px}
.w-id{font-weight:700;font-size:15px}.w-strat{color:var(--accent);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:3px 8px;border-radius:4px}
.badge-PAPER{background:rgba(0,214,143,.12);color:var(--green)}
.badge-LIVE{background:rgba(255,77,106,.12);color:var(--red)}
.w-body{padding:14px 18px}
.m-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.m-cell{text-align:center}.m-label{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:3px}.m-val{font-size:17px;font-weight:700}
.risk-sec{margin-bottom:12px}.risk-sec .r-title{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px}
.risk-bars{display:flex;flex-direction:column;gap:5px}
.rb-row{display:flex;align-items:center;gap:8px}
.rb-row .rb-label{width:110px;font-size:11px;color:var(--muted);flex-shrink:0}
.rb-track{flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}
.rb-fill{height:100%;border-radius:3px;transition:width .5s}
.bar-ok{background:var(--green)}.bar-warn{background:var(--yellow)}.bar-danger{background:var(--red)}
.rb-row .rb-val{width:48px;text-align:right;font-size:11px;font-weight:600}
.pos-sec .p-title{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px}
.pos-sec{margin-top:10px;border-top:1px solid var(--border);padding-top:10px}
.pos-title{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px;font-weight:600}
.pos-list{display:flex;flex-direction:column;gap:3px}
.pos-row{display:flex;align-items:center;gap:8px;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.03)}
.pos-mkt{flex:1;color:var(--text);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
.pos-out{width:30px;font-weight:700;font-size:10px}
.pos-sz{width:50px;text-align:right;color:var(--muted);font-size:10px}
.pos-pnl{width:65px;text-align:right;font-weight:700;font-size:11px}
table{width:100%;border-collapse:collapse}th{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);text-align:left;padding:5px 0;border-bottom:1px solid var(--border)}
td{font-size:12px;padding:5px 0;border-bottom:1px solid var(--border)}.o-YES{color:var(--green);font-weight:600}.o-NO{color:var(--red);font-weight:600}
.empty{color:var(--muted);font-size:12px;font-style:italic}

/* ═══ Toggle switch ═══ */
.toggle-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;border:none;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;text-transform:uppercase;letter-spacing:.4px}
.toggle-btn.running{background:rgba(0,214,143,.12);color:var(--green);border:1px solid rgba(0,214,143,.25)}
.toggle-btn.running:hover{background:rgba(0,214,143,.2)}
.toggle-btn.paused{background:rgba(255,193,7,.12);color:var(--yellow);border:1px solid rgba(255,193,7,.25)}
.toggle-btn.paused:hover{background:rgba(255,193,7,.2)}
.toggle-dot{width:6px;height:6px;border-radius:50%;animation:pulse-anim 2s ease-in-out infinite}
.toggle-btn.running .toggle-dot{background:var(--green)}
.toggle-btn.paused .toggle-dot{background:var(--yellow);animation:none}

/* ═══ Wallets Tab ═══ */
.section-title{font-size:20px;font-weight:700;margin-bottom:18px;display:flex;align-items:center;gap:10px}
.section-title .icon{font-size:22px}
.form-box{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:24px}
.form-box h3{font-size:16px;font-weight:700;margin-bottom:16px}
.form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:16px}
.fg label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px}
.fg input,.fg select{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;color:var(--text);font-size:13px;outline:none;transition:border-color .2s}
.fg input:focus,.fg select:focus{border-color:var(--accent)}
.fg select{-webkit-appearance:none;appearance:none;cursor:pointer}
.form-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.btn{padding:10px 22px;border-radius:var(--radius-sm);border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:#3b7ce6}
.btn-danger{background:rgba(255,77,106,.15);color:var(--red);border:1px solid rgba(255,77,106,.25)}.btn-danger:hover{background:rgba(255,77,106,.25)}
.btn-sm{padding:6px 14px;font-size:11px}
.form-msg{font-size:13px;padding:8px 14px;border-radius:var(--radius-sm);display:none}
.form-msg.ok{display:block;background:rgba(0,214,143,.1);color:var(--green);border:1px solid rgba(0,214,143,.2)}
.form-msg.err{display:block;background:rgba(255,77,106,.1);color:var(--red);border:1px solid rgba(255,77,106,.2)}
.wallet-table{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.wallet-table table{width:100%}
.wallet-table th{padding:12px 18px;background:var(--surface2);font-size:11px}
.wallet-table td{padding:12px 18px;font-size:13px}
.wallet-table tr:hover td{background:rgba(79,143,247,.04)}
.wallet-table tbody tr{cursor:pointer;transition:background .15s}
.wallet-table tbody tr:hover td{background:rgba(79,143,247,.08)}

/* ═══ Strategies Tab ═══ */
.strat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:18px}
.strat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color .2s}
.strat-card:hover{border-color:var(--accent2)}
.strat-hdr{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.strat-hdr .strat-name{font-size:17px;font-weight:700}
.strat-hdr .strat-cat{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--accent2);margin-top:3px}
.strat-risk{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 10px;border-radius:20px;white-space:nowrap;flex-shrink:0;margin-top:2px}
.risk-Low{background:rgba(0,214,143,.12);color:var(--green)}
.risk-Low-Medium{background:rgba(0,214,143,.08);color:#5cd6a5}
.risk-Medium{background:rgba(255,193,7,.12);color:var(--yellow)}
.risk-Medium-High{background:rgba(249,115,22,.12);color:var(--orange)}
.risk-High{background:rgba(255,77,106,.12);color:var(--red)}
.risk-Depends{background:rgba(168,85,247,.12);color:var(--purple)}
.strat-body{padding:18px 20px}
.strat-desc{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:16px}
.strat-section-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--accent);font-weight:600;margin-bottom:8px}
.strat-steps{list-style:none;margin-bottom:16px}
.strat-steps li{font-size:12px;color:var(--text);padding:4px 0 4px 18px;position:relative;line-height:1.5}
.strat-steps li::before{content:'';position:absolute;left:0;top:11px;width:6px;height:6px;border-radius:50%;background:var(--accent2)}
.param-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-bottom:14px}
.param-grid .pk{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px}
.param-grid .pv{font-size:12px;color:var(--text)}
.strat-ideal{font-size:12px;color:var(--green);font-style:italic;margin-top:4px}
.strat-wallets{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.strat-wallets .sw-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px}
.sw-tags{display:flex;gap:6px;flex-wrap:wrap}
.sw-tag{font-size:11px;padding:3px 8px;border-radius:4px;background:var(--surface2);color:var(--text);border:1px solid var(--border)}
.sw-none{font-size:11px;color:var(--muted);font-style:italic}
.use-btn{margin-top:12px}.use-btn .btn{font-size:12px;padding:7px 16px;background:var(--accent2);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer}
.use-btn .btn:hover{background:#5558e6}

/* ═══ Strategy Detail Panel ═══ */
.strat-detail{display:none;animation:slideIn .25s ease-out}
.strat-detail.open{display:block}
@keyframes slideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.strat-detail-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:16px}
.strat-detail-hdr .strat-detail-left{flex:1}
.strat-detail-hdr .strat-detail-title{font-size:28px;font-weight:800;letter-spacing:-.5px;margin-bottom:4px}
.strat-detail-hdr .strat-detail-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}
.strat-detail-tag{font-size:10px;padding:3px 8px;border-radius:12px;background:var(--surface2);color:var(--muted);border:1px solid var(--border)}
.strat-detail-long{font-size:14px;line-height:1.7;color:var(--muted);margin-bottom:28px}
.strat-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
@media(max-width:900px){.strat-detail-grid{grid-template-columns:1fr}}
.strat-detail-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
.strat-detail-section h4{font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.strat-detail-section h4 .sd-icon{font-size:16px}
.filter-pipeline{display:flex;flex-direction:column;gap:10px}
.filter-item{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;transition:border-color .2s}
.filter-item:hover{border-color:var(--accent)}
.filter-item .fi-label{font-size:13px;font-weight:700;color:var(--accent);margin-bottom:4px}
.filter-item .fi-desc{font-size:12px;color:var(--muted);line-height:1.5}
.filter-item .fi-keys{margin-top:6px;display:flex;gap:4px;flex-wrap:wrap}
.filter-item .fi-key{font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(79,143,247,.1);color:var(--accent);font-family:monospace}
.exit-rule{padding:12px 0;border-bottom:1px solid var(--border)}
.exit-rule:last-child{border-bottom:none}
.exit-rule .er-name{font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px}
.exit-rule .er-desc{font-size:12px;color:var(--muted);line-height:1.5}
.sizing-steps{list-style:none;counter-reset:step}
.sizing-steps li{font-size:12px;color:var(--text);padding:6px 0 6px 28px;position:relative;line-height:1.5;counter-increment:step}
.sizing-steps li::before{content:counter(step);position:absolute;left:0;top:6px;width:20px;height:20px;border-radius:50%;background:var(--accent2);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
.risk-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}
.risk-item:last-child{border-bottom:none}
.risk-item .ri-badge{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--red);margin-top:5px}
.risk-item .ri-name{font-size:12px;font-weight:600;color:var(--text);min-width:140px;flex-shrink:0}
.risk-item .ri-desc{font-size:12px;color:var(--muted);line-height:1.4}
.config-table{width:100%;border-collapse:collapse}
.config-table th{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);text-align:left;padding:8px 6px;border-bottom:2px solid var(--border);background:var(--surface2)}
.config-table td{font-size:12px;padding:8px 6px;border-bottom:1px solid var(--border)}
.config-table tr:hover td{background:rgba(79,143,247,.03)}
.config-table .cfg-key{font-family:monospace;color:var(--accent);font-weight:600;font-size:11px}
.config-table .cfg-val{font-weight:700}
.config-group-hdr td{background:var(--surface2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent2);padding:10px 6px}
.live-wallet-card{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.live-wallet-card .lw-id{font-weight:700;font-size:13px}
.live-wallet-card .lw-stats{display:flex;gap:16px;font-size:12px;color:var(--muted)}

/* ═══ Whale Address Management ═══ */
.whale-mgmt{margin-top:20px}
.whale-mgmt-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
.whale-add-form{display:flex;gap:10px;margin-bottom:16px}
.whale-add-form input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-size:13px;font-family:monospace;outline:none;transition:border-color .2s}
.whale-add-form input:focus{border-color:var(--accent)}
.whale-add-form input::placeholder{color:var(--muted);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.whale-add-btn{background:var(--accent2);color:#fff;border:none;border-radius:var(--radius-sm);padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .2s}
.whale-add-btn:hover{background:#5558e6}
.whale-add-btn:disabled{opacity:.5;cursor:not-allowed}
.whale-list{display:flex;flex-direction:column;gap:8px}
.whale-item{display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;transition:border-color .2s}
.whale-item:hover{border-color:var(--accent)}
.whale-item-left{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
.whale-addr{font-family:monospace;font-size:13px;color:var(--accent);word-break:break-all}
.whale-stats{display:flex;gap:12px;align-items:center;flex-shrink:0}
.whale-stat{font-size:11px;color:var(--muted);white-space:nowrap}
.whale-stat .ws-val{font-weight:700;color:var(--text)}
.whale-stat.positive .ws-val{color:var(--green)}
.whale-stat.negative .ws-val{color:var(--red)}
.whale-badge{font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.whale-badge.active{background:rgba(0,214,143,.12);color:var(--green)}
.whale-badge.paused{background:rgba(255,193,7,.12);color:var(--yellow)}
.whale-remove-btn{background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 12px;color:var(--red);font-size:11px;cursor:pointer;transition:all .2s;margin-left:12px}
.whale-remove-btn:hover{background:rgba(255,77,106,.1);border-color:var(--red)}
.whale-empty{color:var(--muted);font-size:13px;font-style:italic;text-align:center;padding:24px}
.whale-msg{font-size:12px;padding:8px 12px;border-radius:var(--radius-sm);margin-bottom:12px;display:none}
.whale-msg.ok{background:rgba(0,214,143,.1);color:var(--green);display:block}
.whale-msg.err{background:rgba(255,77,106,.1);color:var(--red);display:block}

/* ═══ Footer ═══ */
footer{text-align:center;padding:24px;color:var(--muted);font-size:11px;border-top:1px solid var(--border)}

/* ═══ Responsive ═══ */
@media(max-width:900px){
  .header{padding:0 16px;gap:16px}
  .main{padding:16px}
  .wallet-grid,.strat-grid{grid-template-columns:1fr}
  .m-row{grid-template-columns:repeat(2,1fr)}
  .form-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:600px){
  .tabs{gap:0}
  .tab-btn{padding:16px 12px;font-size:12px}
  .form-grid{grid-template-columns:1fr}
  .param-grid{grid-template-columns:1fr}
}

/* ═══ Analytics Tab ═══ */
.chart-bar{position:absolute;bottom:0;background:var(--accent);border-radius:2px 2px 0 0;min-width:2px;transition:height .3s}
.chart-bar.neg{background:var(--red)}
.chart-line-container{position:relative;width:100%;height:100%}
.chart-line-container svg{width:100%;height:100%}
.an-stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;text-align:center}
.an-stat-card .label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px}
.an-stat-card .value{font-size:22px;font-weight:700}
.an-stat-card .sub{font-size:11px;color:var(--muted);margin-top:3px}

/* ═══ Wallet Detail Overlay ═══ */
#wallet-detail-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);z-index:1000;overflow-y:auto}
#wallet-detail-overlay.active{display:block}
.wd-header{display:flex;align-items:center;justify-content:space-between;padding:20px 32px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:10}
.wd-header h2{font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px}
.wd-back{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 16px;color:var(--text);font-size:13px;cursor:pointer;font-weight:600}
.wd-back:hover{background:var(--surface)}
.wd-content{padding:24px 32px;max-width:1400px;margin:0 auto}
.wd-summary{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px}
.wd-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;text-align:center}
.wd-stat .label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px}
.wd-stat .value{font-size:20px;font-weight:700}
.wd-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:20px}
.wd-section h3{font-size:15px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.wd-chart{width:100%;height:200px;background:var(--surface2);border-radius:var(--radius-sm);overflow:hidden;position:relative}
.wd-chart svg{width:100%;height:100%}
.wd-risk-bars{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.wd-rb{display:flex;align-items:center;gap:10px}
.wd-rb .lbl{width:140px;font-size:12px;color:var(--muted)}
.wd-rb .track{flex:1;height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}
.wd-rb .fill{height:100%;border-radius:4px;transition:width .5s}
.wd-rb .val{width:60px;text-align:right;font-size:12px;font-weight:600}
.wd-trades-table{width:100%;border-collapse:collapse}
.wd-trades-table th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface)}
.wd-trades-table td{font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
.wd-trades-table tr:hover td{background:rgba(79,143,247,.04)}
.wd-mkt-table{width:100%;border-collapse:collapse}
.wd-mkt-table th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--border)}
.wd-mkt-table td{font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
.wd-2col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:900px){.wd-2col{grid-template-columns:1fr}}

/* ═══ Wallet Detail Drill-Down Modal ═══ */
#wd-drill-modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:2000;overflow-y:auto}
#wd-drill-modal.active{display:block}
.wd-drill-box{max-width:900px;margin:40px auto;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px;position:relative;animation:slideIn .2s ease-out}
.wd-drill-close{position:absolute;top:14px;right:18px;background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1}
.wd-drill-close:hover{color:var(--text)}
.wd-drill-title{font-size:18px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:10px}
.wd-drill-subtitle{font-size:12px;color:var(--muted);margin-bottom:20px;word-break:break-all}
.wd-drill-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:22px}
.wd-drill-stat{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center}
.wd-drill-stat .label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px}
.wd-drill-stat .value{font-size:18px;font-weight:700}
.wd-drill-table{width:100%;border-collapse:collapse;margin-top:12px}
.wd-drill-table th{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);background:var(--surface2);position:sticky;top:0}
.wd-drill-table td{font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
.wd-drill-table tr:hover td{background:rgba(79,143,247,.04)}
.clickable-row{cursor:pointer;transition:background .15s}
.clickable-row:hover td{background:rgba(79,143,247,.08) !important}

/* ═══ Wallet Detail Tabs ═══ */
.wd-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;position:sticky;top:0;background:var(--bg);z-index:5;padding-top:4px}
.wd-tab{padding:12px 24px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s;white-space:nowrap}
.wd-tab:hover{color:var(--text);background:rgba(79,143,247,.04)}
.wd-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.wd-tab-panel{display:none}
.wd-tab-panel.active{display:block}

/* ═══ Wallet Settings Form ═══ */
.ws-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:20px}
.ws-section h3{font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.ws-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.ws-field{display:flex;flex-direction:column;gap:6px}
.ws-field label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600}
.ws-field input,.ws-field select{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-size:14px;font-weight:500;transition:border-color .2s}
.ws-field input:focus,.ws-field select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,143,247,.15)}
.ws-field input:disabled{opacity:.5;cursor:not-allowed}
.ws-field .hint{font-size:10px;color:var(--muted);margin-top:2px}
.ws-actions{display:flex;gap:10px;margin-top:18px;align-items:center}
.ws-msg{font-size:12px;margin-left:auto;padding:6px 12px;border-radius:var(--radius-sm)}
.ws-msg.ok{color:var(--green);background:rgba(0,214,143,.08)}
.ws-msg.err{color:var(--red);background:rgba(255,77,106,.08)}

/* Status/Toggle in detail panel */
.wd-status-bar{display:flex;align-items:center;gap:16px;padding:16px 20px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:20px}
.wd-status-indicator{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.wd-status-indicator.running{background:var(--green);box-shadow:0 0 8px rgba(0,214,143,.4)}
.wd-status-indicator.paused{background:var(--yellow);box-shadow:0 0 8px rgba(255,193,7,.4)}
.wd-status-text{font-size:14px;font-weight:600;flex:1}
.wd-status-text .sub{font-size:12px;color:var(--muted);font-weight:400;margin-left:8px}

/* Danger zone */
.ws-danger{background:rgba(255,77,106,.04);border:1px solid rgba(255,77,106,.2);border-radius:var(--radius);padding:24px;margin-top:20px}
.ws-danger h3{color:var(--red)}
.ws-danger p{font-size:12px;color:var(--muted);margin-bottom:14px}

/* ═══ Console Sub-Tabs ═══ */
.con-sub-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px}
.con-sub-tab{padding:10px 22px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s;white-space:nowrap;display:flex;align-items:center;gap:6px}
.con-sub-tab:hover{color:var(--text);background:rgba(79,143,247,.04)}
.con-sub-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.con-sub-panel{display:none}
.con-sub-panel.active{display:block}

/* ═══ Trade Log ═══ */
.tl-total-banner{background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--border);border-radius:var(--radius);padding:28px 32px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
.tl-total-pnl{font-size:42px;font-weight:800;font-family:'JetBrains Mono','Fira Code',monospace;letter-spacing:-1px}
.tl-total-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:4px}
.tl-stats-row{display:flex;gap:24px;flex-wrap:wrap;align-items:center}
.tl-stat{text-align:center}
.tl-stat .label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:2px}
.tl-stat .value{font-size:18px;font-weight:700}
.tl-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.tl-toolbar select,.tl-toolbar input{background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:6px 10px;border-radius:6px;font-size:12px}
.tl-toolbar input{flex:1;min-width:140px}
.tl-table-wrap{overflow-y:auto;max-height:calc(100vh - 380px);border:1px solid var(--border);border-radius:var(--radius-sm)}
.tl-table{width:100%;border-collapse:collapse;font-size:12px}
.tl-table th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:1}
.tl-table td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);white-space:nowrap}
.tl-table tbody tr{transition:background .15s}
.tl-table tbody tr:hover td{background:rgba(79,143,247,.05)}
.tl-table .side-buy{color:var(--green);font-weight:600}
.tl-table .side-sell{color:var(--red);font-weight:600}
.tl-table .pnl-cell{font-weight:600;font-family:'JetBrains Mono','Fira Code',monospace}
.tl-empty{text-align:center;padding:60px 20px;color:var(--muted);font-size:14px}
.tl-empty .icon{font-size:40px;margin-bottom:12px}
.tl-live-dot{width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.tl-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-block}
.tl-badge-buy{background:rgba(0,214,143,.12);color:var(--green)}
.tl-badge-sell{background:rgba(255,77,106,.12);color:var(--red)}
.tl-wallet-tag{font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(79,143,247,.1);color:var(--accent);font-weight:500;display:inline-block;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tl-market-id{font-size:11px;color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:middle}
.tl-footer{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:11px;color:var(--muted)}
.ext-link-row{display:flex;gap:8px;margin-top:2px;flex-wrap:wrap}
.ext-link{font-size:10px;color:var(--accent);text-decoration:none;font-weight:600}
.ext-link:hover{text-decoration:underline}
.ext-link-muted{color:var(--muted)}
</style>
</head>
<body>

<!-- ═══ WALLET DETAIL OVERLAY ═══ -->
<div id="wallet-detail-overlay">
  <div class="wd-header">
    <h2><span>\uD83D\uDCB0</span> <span id="wd-title">Wallet Detail</span></h2>
    <button class="wd-back" onclick="closeWalletDetail()">\u2190 Back to Dashboard</button>
  </div>
  <div class="wd-content" id="wd-content"></div>
</div>

<!-- ═══ DRILL-DOWN MODAL ═══ -->
<div id="wd-drill-modal">
  <div class="wd-drill-box">
    <button class="wd-drill-close" onclick="closeDrillDown()">\u2715</button>
    <div id="wd-drill-content"></div>
  </div>
</div>

<!-- ═══ HEADER ═══ -->
<div class="header">
  <div class="logo"><span>Poly</span>Market Strategies</div>
  <div class="tabs">
    <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
    <button class="tab-btn" data-tab="markets">Markets</button>
    <button class="tab-btn" data-tab="wallets">Wallets</button>
    <button class="tab-btn" data-tab="strategies">Strategies</button>
    <button class="tab-btn" data-tab="analytics">Analytics</button>
    <button class="tab-btn" data-tab="whales">🐋 Whales</button>
    <button class="tab-btn" data-tab="console">📟 Console</button>
  </div>
  <div class="header-right">
    <button id="kill-switch-btn" style="background:#b42318;color:#fff;border:1px solid #ef4444;font-size:12px;font-weight:700;padding:6px 10px;border-radius:8px;cursor:pointer">Kill Switch</button>
    <span class="pulse"></span>
    <span class="header-ts" id="hdr-ts">Loading\u2026</span>
  </div>
</div>

<!-- ═══ MAIN CONTENT ═══ -->
<div class="main">

<!-- ═════════════ TAB 1: DASHBOARD ═════════════ -->
<div class="tab-pane active" id="pane-dashboard">
  <div class="summary-row" id="summary"></div>
  <div class="summary-row" id="execution-health"></div>
  <div class="wallet-grid" id="wallets"></div>
</div>

<!-- ═════════════ TAB 2: WALLETS ═════════════ -->
<div class="tab-pane" id="pane-wallets">
  <div class="section-title"><span class="icon">\uD83D\uDCB0</span> Wallet Management</div>

  <div class="form-box">
    <h3>Create New Wallet</h3>
    <div class="form-grid">
      <div class="fg"><label>Wallet ID</label><input id="cw-id" placeholder="e.g. wallet_4"></div>
      <div class="fg"><label>Mode</label>
        <select id="cw-mode"><option value="PAPER">PAPER (simulated)</option><option value="LIVE">LIVE (real money)</option></select>
      </div>
      <div class="fg"><label>Strategy</label><select id="cw-strategy"></select></div>
      <div class="fg"><label>Capital ($)</label><input id="cw-capital" type="number" min="1" value="500" placeholder="500"></div>
      <div class="fg"><label>Max Position Size</label><input id="cw-maxpos" type="number" placeholder="auto"></div>
      <div class="fg"><label>Max Exposure / Market</label><input id="cw-maxexp" type="number" placeholder="auto"></div>
      <div class="fg"><label>Max Daily Loss</label><input id="cw-maxloss" type="number" placeholder="auto"></div>
      <div class="fg"><label>Max Open Trades</label><input id="cw-maxtrades" type="number" value="10" placeholder="10"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="cw-submit">Create Wallet</button>
      <div class="form-msg" id="cw-msg"></div>
    </div>
  </div>

  <div class="wallet-table" id="wallet-table">
    <table>
      <thead><tr>
        <th>Wallet ID</th><th>Mode</th><th>Strategy</th><th>Capital</th><th>Balance</th><th>PnL</th><th>Positions</th><th>Actions</th>
      </tr></thead>
      <tbody id="wt-body"></tbody>
    </table>
  </div>
</div>

<!-- ═════════════ TAB 3: STRATEGIES ═════════════ -->
<div class="tab-pane" id="pane-strategies">
  <div class="section-title" id="strat-list-title"><span class="icon">\uD83E\uDDE0</span> Strategy Library</div>
  <div class="strat-grid" id="strat-grid"></div>

  <!-- Strategy Detail Panel (hidden by default) -->
  <div class="strat-detail" id="strat-detail">
    <div style="margin-bottom:16px">
      <button class="btn btn-sm" id="strat-back" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:12px;padding:8px 16px;border-radius:6px;cursor:pointer">\u2190 Back to Strategy Library</button>
    </div>

    <div class="strat-detail-hdr">
      <div class="strat-detail-left">
        <div class="strat-detail-title" id="sd-title"></div>
        <div class="strat-detail-meta">
          <span class="strat-risk" id="sd-risk"></span>
          <span style="font-size:12px;color:var(--accent2);font-weight:600" id="sd-category"></span>
          <span style="font-size:11px;color:var(--muted)" id="sd-version"></span>
        </div>
        <div class="strat-detail-meta" id="sd-tags"></div>
      </div>
      <div class="use-btn"><button class="btn" id="sd-create-btn">+ Create Wallet With This Strategy</button></div>
    </div>

    <div class="strat-detail-long" id="sd-long-desc"></div>

    <!-- How It Works -->
    <div class="strat-detail-section" style="margin-bottom:20px">
      <h4><span class="sd-icon">\u2699\uFE0F</span> How It Works</h4>
      <ul class="strat-steps" id="sd-how"></ul>
    </div>

    <!-- Live Wallets -->
    <div id="sd-live-wallets-section" style="margin-bottom:20px"></div>

    <!-- Whale Address Management (copy_trade only) -->
    <div id="sd-whale-mgmt" class="whale-mgmt" style="display:none;margin-bottom:20px">
      <div class="whale-mgmt-section">
        <h4 style="font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span class="sd-icon">\uD83D\uDC33</span> Whale Addresses
          <span id="whale-count" style="font-size:12px;color:var(--muted);font-weight:400"></span>
        </h4>
        <div id="whale-msg" class="whale-msg"></div>
        <div class="whale-add-form">
          <input type="text" id="whale-addr-input" placeholder="Enter whale wallet address (0x\u2026)" spellcheck="false" autocomplete="off">
          <button class="whale-add-btn" id="whale-add-btn">\uD83D\uDC33 Add Whale</button>
        </div>
        <div class="whale-list" id="whale-list">
          <div class="whale-empty">No whale addresses configured yet. Add one above to start copy trading.</div>
        </div>
      </div>
    </div>

    <!-- Basic Parameters (shown for strategies without advanced detail) -->
    <div class="strat-detail-section" id="sd-params-section" style="margin-bottom:20px;display:none">
      <h4><span class="sd-icon">\u2699\uFE0F</span> Parameters</h4>
      <div class="param-grid" id="sd-params" style="gap:8px"></div>
    </div>

    <!-- 2-column grid: Filters | Entry + Exits -->
    <div class="strat-detail-grid">
      <!-- Left: Filter Pipeline -->
      <div class="strat-detail-section">
        <h4><span class="sd-icon">\uD83D\uDD0D</span> Filter Pipeline (7 Stages)</h4>
        <div class="filter-pipeline" id="sd-filters"></div>
      </div>

      <!-- Right: Entry + Position Sizing -->
      <div>
        <div class="strat-detail-section" style="margin-bottom:20px">
          <h4><span class="sd-icon">\uD83C\uDFAF</span> Entry Logic</h4>
          <ul class="strat-steps" id="sd-entry"></ul>
        </div>
        <div class="strat-detail-section">
          <h4><span class="sd-icon">\uD83D\uDCCF</span> Position Sizing</h4>
          <ol class="sizing-steps" id="sd-sizing"></ol>
        </div>
      </div>
    </div>

    <!-- 2-column grid: Exit Rules | Risk Controls -->
    <div class="strat-detail-grid" style="margin-top:20px">
      <div class="strat-detail-section">
        <h4><span class="sd-icon">\uD83D\uDEAA</span> Exit Rules</h4>
        <div id="sd-exits"></div>
      </div>
      <div class="strat-detail-section">
        <h4><span class="sd-icon">\uD83D\uDEE1\uFE0F</span> Risk Controls</h4>
        <div id="sd-risks"></div>
      </div>
    </div>

    <!-- Full Config Table -->
    <div class="strat-detail-section" style="margin-top:20px" id="sd-config-section">
      <h4><span class="sd-icon">\u2699\uFE0F</span> Configuration Parameters</h4>
      <div style="overflow-x:auto">
        <table class="config-table" id="sd-config-table">
          <thead><tr><th>Parameter</th><th>Label</th><th>Default</th><th>Unit</th><th>Description</th></tr></thead>
          <tbody id="sd-config-body"></tbody>
        </table>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px">
      <span class="strat-ideal" id="sd-ideal"></span>
    </div>
  </div>
</div>

<!-- ═════════════ TAB: LIVE MARKETS ═════════════ -->
<div class="tab-pane" id="pane-markets">
  <div class="section-title"><span class="icon">\uD83C\uDF0D</span> Live Polymarket Markets</div>
  <p style="color:var(--muted);margin-bottom:16px">Real-time data from the Polymarket Gamma API. Top active markets sorted by 24h volume.</p>
  <button class="btn btn-primary" id="mkts-refresh" style="margin-bottom:16px">\uD83D\uDD04 Refresh Markets</button>
  <div class="table-wrap"><table class="tbl" id="mkts-table">
    <thead><tr>
      <th>Market</th><th>YES</th><th>NO</th><th>Bid</th><th>Ask</th><th>Spread</th><th>24h Vol</th><th>Liquidity</th>
    </tr></thead>
    <tbody id="mkts-body"><tr><td colspan="8" style="text-align:center;color:var(--muted)">Loading markets\u2026</td></tr></tbody>
  </table></div>
</div>

<!-- ═════════════ TAB 4: ANALYTICS ═════════════ -->
<div class="tab-pane" id="pane-analytics">
  <div class="section-title"><span class="icon">\uD83D\uDCCA</span> Trading Analytics</div>

  <div class="form-box" style="margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div class="fg" style="min-width:220px">
        <label>Select Wallet</label>
        <select id="an-wallet"><option value="">-- choose a wallet --</option></select>
      </div>
      <button class="btn btn-primary" id="an-load" style="margin-top:18px">Load History</button>
      <button class="btn" id="an-refresh" style="margin-top:18px;background:var(--surface2);color:var(--text);border:1px solid var(--border)">Auto-refresh: OFF</button>
    </div>
  </div>

  <!-- summary stats -->
  <div id="an-summary" style="display:none">
    <div class="summary-row" id="an-stats" style="margin-bottom:20px"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- PnL curve -->
      <div class="form-box" style="margin-bottom:0">
        <h3 style="font-size:14px;margin-bottom:12px">Cumulative PnL</h3>
        <div id="an-pnl-chart" style="height:180px;position:relative;overflow:hidden"></div>
      </div>
      <!-- Balance curve -->
      <div class="form-box" style="margin-bottom:0">
        <h3 style="font-size:14px;margin-bottom:12px">Balance Over Time</h3>
        <div id="an-bal-chart" style="height:180px;position:relative;overflow:hidden"></div>
      </div>
    </div>

    <!-- trade table -->
    <div class="wallet-table">
      <table>
        <thead><tr>
          <th>#</th><th>Time</th><th>Market</th><th>Side</th><th>Outcome</th><th>Price</th><th>Size</th><th>Cost</th><th>PnL</th><th>Cumulative PnL</th><th>Balance</th>
        </tr></thead>
        <tbody id="an-tbody"></tbody>
      </table>
    </div>
  </div>

  <div id="an-empty" class="form-box" style="text-align:center;color:var(--muted);padding:48px">
    <div style="font-size:36px;margin-bottom:12px">\uD83D\uDCCA</div>
    <div>Select a wallet above and click <strong>Load History</strong> to view trading analytics.</div>
  </div>
</div>

<!-- ═════════════ TAB 6: WHALES ═════════════ -->
<div class="tab-pane" id="pane-whales">
  <div class="section-title"><span class="icon">🐋</span> Whale Tracking Engine</div>

  <!-- Whale summary cards -->
  <div class="summary-row" id="wh-summary" style="margin-bottom:12px">
    <div class="s-card"><div class="label">Tracked Whales</div><div class="value" id="wh-total">-</div></div>
    <div class="s-card"><div class="label">Unread Alerts</div><div class="value" id="wh-alerts">-</div></div>
    <div class="s-card"><div class="label">Candidates</div><div class="value" id="wh-candidates">-</div></div>
    <div class="s-card"><div class="label">Service</div><div class="value" id="wh-status">-</div></div>
    <div class="s-card"><div class="label">Scanner</div><div class="value" id="wh-scanner-status">-</div></div>
  </div>

  <!-- Scanner controls (always visible at top) -->
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:18px;flex-wrap:wrap;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
    <span style="font-size:13px;font-weight:600;color:var(--text);margin-right:4px">\uD83D\uDD0D Scanner:</span>
    <span id="wh-top-scanner-st" style="font-size:12px;font-weight:600;color:var(--muted)">-</span>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button class="btn btn-primary btn-sm" id="wh-top-start" style="font-size:12px;padding:6px 16px">\u25B6 Start Scanner</button>
      <button class="btn btn-sm" id="wh-top-stop" style="background:var(--red);color:#fff;border:none;font-size:12px;padding:6px 16px;border-radius:6px;cursor:pointer">\u25A0 Stop Scanner</button>
      <button class="btn btn-sm" id="wh-top-scan" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:12px;padding:6px 16px;border-radius:6px;cursor:pointer">\u26A1 Scan Now</button>
    </div>
  </div>

  <!-- Sub-navigation -->
  <div style="display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap">
    <button class="btn btn-primary wh-sub active" data-sub="list">Whale List</button>
    <button class="btn wh-sub" data-sub="candidates" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">Candidates</button>
    <button class="btn wh-sub" data-sub="alerts" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">Alerts</button>
    <button class="btn wh-sub" data-sub="signals" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">Signals</button>
    <button class="btn wh-sub" data-sub="watchlists" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">Watchlists</button>
    <button class="btn wh-sub" data-sub="scanner" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">🔍 Scanner</button>
    <button class="btn wh-sub" data-sub="clusters" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">🔗 Clusters</button>
    <button class="btn wh-sub" data-sub="network" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">🕸️ Network</button>
    <button class="btn wh-sub" data-sub="copysim" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">📋 Copy Sim</button>
    <button class="btn wh-sub" data-sub="regime" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">📊 Regime</button>
    <button class="btn wh-sub" data-sub="apipool" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">⚡ API Pool</button>
    <button class="btn wh-sub" data-sub="add" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">+ Add Whale</button>
  </div>

  <!-- Sub-views -->
  <div id="wh-view-list" class="wh-view">
    <div class="wallet-table"><table>
      <thead><tr><th>⭐</th><th>Address</th><th>Name</th><th>Style</th><th>Score</th><th>Vol 30d</th><th>PnL 30d</th><th>Win Rate</th><th>Integrity</th><th>Actions</th></tr></thead>
      <tbody id="wh-list-body"><tr><td colspan="10" class="empty">Loading…</td></tr></tbody>
    </table></div>
  </div>

  <div id="wh-view-candidates" class="wh-view" style="display:none">
    <div class="wallet-table"><table>
      <thead><tr><th>Address</th><th>Volume 24h</th><th>Trades 24h</th><th>Max Trade</th><th>Markets 7d</th><th>Rank</th><th>Tags</th><th>Actions</th></tr></thead>
      <tbody id="wh-cand-body"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody>
    </table></div>
  </div>

  <div id="wh-view-alerts" class="wh-view" style="display:none">
    <div style="margin-bottom:10px"><button class="btn btn-sm" id="wh-mark-all-read" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:12px;padding:6px 14px;border-radius:6px;cursor:pointer">Mark all read</button></div>
    <div class="wallet-table"><table>
      <thead><tr><th>Time</th><th>Type</th><th>Whale</th><th>Details</th><th>Status</th></tr></thead>
      <tbody id="wh-alert-body"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
    </table></div>
  </div>

  <div id="wh-view-signals" class="wh-view" style="display:none">
    <div class="wallet-table"><table>
      <thead><tr><th>Time</th><th>Type</th><th>Details</th></tr></thead>
      <tbody id="wh-signal-body"><tr><td colspan="3" class="empty">Loading…</td></tr></tbody>
    </table></div>
  </div>

  <div id="wh-view-watchlists" class="wh-view" style="display:none">
    <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center">
      <input id="wh-wl-name" placeholder="New watchlist name" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:13px;outline:none">
      <button class="btn btn-primary btn-sm" id="wh-wl-create" style="font-size:12px;padding:8px 14px">Create</button>
    </div>
    <div id="wh-wl-list"></div>
  </div>

  <div id="wh-view-scanner" class="wh-view" style="display:none">
    <!-- Scanner controls -->
    <div class="form-box" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">🔍 Liquid Market Scanner</h3>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-sm" id="wh-scan-start" style="font-size:12px;padding:6px 14px">▶ Start</button>
          <button class="btn btn-sm" id="wh-scan-stop" style="background:var(--red);color:#fff;border:none;font-size:12px;padding:6px 14px;border-radius:6px;cursor:pointer">■ Stop</button>
          <button class="btn btn-sm" id="wh-scan-trigger" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:12px;padding:6px 14px;border-radius:6px;cursor:pointer">⚡ Scan Now</button>
        </div>
      </div>
      <div class="summary-row" id="wh-scan-stats">
        <div class="s-card"><div class="label">Status</div><div class="value" id="wh-scan-st">-</div></div>
        <div class="s-card"><div class="label">Markets Scanned</div><div class="value" id="wh-scan-mkts">-</div></div>
        <div class="s-card"><div class="label">Total Discovered</div><div class="value" id="wh-scan-disc">-</div></div>
        <div class="s-card"><div class="label">Profiles Found</div><div class="value" id="wh-scan-prof">-</div></div>
        <div class="s-card"><div class="label">Qualified</div><div class="value" id="wh-scan-qual">-</div></div>
        <div class="s-card"><div class="label">Batch</div><div class="value" id="wh-scan-batch">-</div></div>
        <div class="s-card"><div class="label">Last Scan</div><div class="value" id="wh-scan-last" style="font-size:11px">-</div></div>
        <div class="s-card"><div class="label">Duration</div><div class="value" id="wh-scan-dur">-</div></div>
        <div class="s-card"><div class="label">Total Time</div><div class="value" id="wh-scan-total-time">-</div></div>
        <div class="s-card"><div class="label">⚡ Mkts/sec</div><div class="value" id="wh-scan-mps" style="color:var(--blue)">-</div></div>
        <div class="s-card"><div class="label">⚡ Trades/sec</div><div class="value" id="wh-scan-tps" style="color:var(--blue)">-</div></div>
        <div class="s-card"><div class="label">⚡ Avg Latency</div><div class="value" id="wh-scan-lat" style="color:var(--blue)">-</div></div>
        <div class="s-card"><div class="label">⚡ Workers</div><div class="value" id="wh-scan-workers" style="color:var(--blue)">-</div></div>
      </div>
      <div id="wh-scan-err" style="display:none;color:var(--red);font-size:12px;margin-top:8px"></div>
    </div>

    <!-- Discovered profiles table -->
    <div class="form-box">
      <h3 style="margin-bottom:12px">Discovered Whale Profiles <span style="font-size:12px;color:var(--muted)">(click a row for details)</span></h3>
      <div class="wallet-table"><table>
        <thead><tr><th>Address</th><th>Score</th><th>Volume</th><th>Trades</th><th>Markets</th><th>Win Rate</th><th>PnL</th><th>ROI</th><th>Avg Hold</th><th>Tags</th><th>Actions</th></tr></thead>
        <tbody id="wh-scan-profiles"><tr><td colspan="11" class="empty">No scan results yet. Start the scanner or trigger a manual scan.</td></tr></tbody>
      </table></div>
    </div>

    <!-- Profile detail modal -->
    <div id="wh-scan-profile-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;overflow-y:auto">
      <div style="max-width:800px;margin:40px auto;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;position:relative">
        <button id="wh-profile-close" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer">✕</button>
        <div id="wh-profile-content">Loading…</div>
      </div>
    </div>
  </div>

  <!-- ═══ CLUSTER SIGNALS VIEW ═══ -->
  <div id="wh-view-clusters" class="wh-view" style="display:none">
    <div class="form-box" style="margin-bottom:16px">
      <h3 style="margin:0 0 12px 0">🔗 Cluster Signals</h3>
      <p style="font-size:12px;color:var(--muted);margin:0 0 12px 0">When multiple tracked whales converge on the same market within a time window, a cluster signal is generated. Higher confidence = more whales + larger combined size.</p>
      <div class="summary-row" id="wh-cluster-summary">
        <div class="s-card"><div class="label">Active Signals</div><div class="value" id="wh-cl-count">-</div></div>
        <div class="s-card"><div class="label">High Confidence</div><div class="value" id="wh-cl-high">-</div></div>
        <div class="s-card"><div class="label">Avg Confidence</div><div class="value" id="wh-cl-avg">-</div></div>
        <div class="s-card"><div class="label">Markets w/ Clusters</div><div class="value" id="wh-cl-markets">-</div></div>
      </div>
    </div>
    <div class="form-box">
      <div class="wallet-table"><table>
        <thead><tr><th>Market</th><th>Side</th><th>Whales</th><th>Combined Size</th><th>Avg Price</th><th>Confidence</th><th>TTL</th><th>Created</th></tr></thead>
        <tbody id="wh-cluster-body"><tr><td colspan="8" class="empty">Loading cluster signals…</td></tr></tbody>
      </table></div>
    </div>
  </div>

  <!-- ═══ NETWORK GRAPH VIEW ═══ -->
  <div id="wh-view-network" class="wh-view" style="display:none">
    <div class="form-box" style="margin-bottom:16px">
      <h3 style="margin:0 0 12px 0">🕸️ Whale Network Graph</h3>
      <p style="font-size:12px;color:var(--muted);margin:0 0 12px 0">Co-trading adjacency map showing which whales frequently trade the same markets. Stronger edges = more shared markets and higher correlation.</p>
      <div class="summary-row" id="wh-net-summary">
        <div class="s-card"><div class="label">Nodes (Whales)</div><div class="value" id="wh-net-nodes">-</div></div>
        <div class="s-card"><div class="label">Edges</div><div class="value" id="wh-net-edges">-</div></div>
        <div class="s-card"><div class="label">Strongest Link</div><div class="value" id="wh-net-strongest" style="font-size:11px">-</div></div>
        <div class="s-card"><div class="label">Avg Weight</div><div class="value" id="wh-net-avgw">-</div></div>
      </div>
    </div>
    <div class="form-box">
      <h4 style="font-size:13px;color:var(--muted);margin-bottom:10px">Network Edges <span style="font-size:11px">(sorted by weight)</span></h4>
      <div class="wallet-table"><table>
        <thead><tr><th>Whale A</th><th>Whale B</th><th>Shared Markets</th><th>Weight</th><th>Correlation</th></tr></thead>
        <tbody id="wh-net-body"><tr><td colspan="5" class="empty">Loading network graph…</td></tr></tbody>
      </table></div>
    </div>
  </div>

  <!-- ═══ COPY SIMULATOR VIEW ═══ -->
  <div id="wh-view-copysim" class="wh-view" style="display:none">
    <div class="form-box" style="margin-bottom:16px">
      <h3 style="margin:0 0 12px 0">📋 Copy-Trade Simulator</h3>
      <p style="font-size:12px;color:var(--muted);margin:0 0 12px 0">Paper-simulates copying each top whale's trades with realistic slippage and delay. Shows what your PnL would be if you mirrored their positions.</p>
      <div class="summary-row" id="wh-cs-summary">
        <div class="s-card"><div class="label">Whales Simulated</div><div class="value" id="wh-cs-count">-</div></div>
        <div class="s-card"><div class="label">Profitable</div><div class="value" id="wh-cs-profit">-</div></div>
        <div class="s-card"><div class="label">Best ROI</div><div class="value" id="wh-cs-best">-</div></div>
        <div class="s-card"><div class="label">Total Sim PnL</div><div class="value" id="wh-cs-total">-</div></div>
      </div>
    </div>
    <div class="form-box">
      <div class="wallet-table"><table>
        <thead><tr><th>Whale</th><th>Trades Copied</th><th>Sim PnL</th><th>ROI</th><th>Win Rate</th><th>Avg Slippage</th><th>Max Drawdown</th><th>Sharpe</th><th>Verdict</th></tr></thead>
        <tbody id="wh-cs-body"><tr><td colspan="9" class="empty">Loading copy-sim results…</td></tr></tbody>
      </table></div>
    </div>
  </div>

  <!-- ═══ REGIME STATE VIEW ═══ -->
  <div id="wh-view-regime" class="wh-view" style="display:none">
    <div class="form-box" style="margin-bottom:16px">
      <h3 style="margin:0 0 12px 0">📊 Market Regime</h3>
      <p style="font-size:12px;color:var(--muted);margin:0 0 12px 0">Adaptive regime detection evaluates overall market conditions — BULL, BEAR, CHOPPY, or LOW_ACTIVITY — and adjusts whale scoring thresholds accordingly.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px" id="wh-regime-cards">
        <div class="s-card" style="padding:20px;text-align:center">
          <div class="label">Current Regime</div>
          <div class="value" id="wh-rg-regime" style="font-size:28px;font-weight:700">-</div>
        </div>
        <div class="s-card" style="padding:20px;text-align:center">
          <div class="label">Confidence</div>
          <div class="value" id="wh-rg-confidence">-</div>
        </div>
        <div class="s-card" style="padding:20px;text-align:center">
          <div class="label">Volatility</div>
          <div class="value" id="wh-rg-volatility">-</div>
        </div>
        <div class="s-card" style="padding:20px;text-align:center">
          <div class="label">Avg Price Change</div>
          <div class="value" id="wh-rg-avgchange">-</div>
        </div>
        <div class="s-card" style="padding:20px;text-align:center">
          <div class="label">Active Markets</div>
          <div class="value" id="wh-rg-active">-</div>
        </div>
        <div class="s-card" style="padding:20px;text-align:center">
          <div class="label">Determined At</div>
          <div class="value" id="wh-rg-time" style="font-size:11px">-</div>
        </div>
      </div>
    </div>
    <div class="form-box">
      <h4 style="font-size:13px;color:var(--muted);margin-bottom:10px">Regime-Adjusted Scoring Multipliers</h4>
      <div id="wh-rg-adjustments" style="font-size:13px;color:var(--text)">
        <p class="empty">Loading regime state…</p>
      </div>
    </div>
  </div>

  <!-- ═══ API POOL VIEW ═══ -->
  <div id="wh-view-apipool" class="wh-view" style="display:none">
    <div class="form-box" style="margin-bottom:16px">
      <h3 style="margin:0 0 12px 0">⚡ API Pool Status</h3>
      <p style="font-size:12px;color:var(--muted);margin:0 0 12px 0">Multi-endpoint rotation pool for bypassing rate limits. Requests are distributed across endpoints using the configured strategy. Unhealthy endpoints are auto-disabled and re-tested.</p>
      <div class="summary-row" id="wh-ap-summary">
        <div class="s-card"><div class="label">Strategy</div><div class="value" id="wh-ap-strategy">-</div></div>
        <div class="s-card"><div class="label">Total Endpoints</div><div class="value" id="wh-ap-total">-</div></div>
        <div class="s-card"><div class="label">Healthy</div><div class="value" id="wh-ap-healthy">-</div></div>
        <div class="s-card"><div class="label">Total Requests</div><div class="value" id="wh-ap-reqs">-</div></div>
        <div class="s-card"><div class="label">Total Failures</div><div class="value" id="wh-ap-fails">-</div></div>
        <div class="s-card"><div class="label">Effective RPM</div><div class="value" id="wh-ap-rpm">-</div></div>
      </div>
    </div>
    <div class="form-box">
      <h4 style="font-size:13px;color:var(--muted);margin-bottom:10px">Endpoint Health</h4>
      <div class="wallet-table"><table>
        <thead><tr><th>#</th><th>Base URL</th><th>Status</th><th>Weight</th><th>Requests</th><th>Failures</th><th>Fail Rate</th><th>Rate Limit</th><th>Last Used</th></tr></thead>
        <tbody id="wh-ap-body"><tr><td colspan="9" class="empty">Loading API pool status…</td></tr></tbody>
      </table></div>
    </div>
  </div>

  <div id="wh-view-add" class="wh-view" style="display:none">
    <div class="form-box">
      <h3>Add Whale Address</h3>
      <div class="form-grid">
        <div class="fg"><label>Wallet Address</label><input id="wh-add-addr" placeholder="0x…"></div>
        <div class="fg"><label>Display Name (optional)</label><input id="wh-add-name" placeholder="e.g. Smart Money 1"></div>
        <div class="fg"><label>Tags (comma-separated)</label><input id="wh-add-tags" placeholder="e.g. high_volume,informed"></div>
        <div class="fg"><label>Notes</label><input id="wh-add-notes" placeholder="Optional notes"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="wh-add-btn">Track Whale</button>
        <span id="wh-add-msg" style="color:var(--green);font-size:12px"></span>
      </div>
    </div>
  </div>

  <!-- Whale detail panel (shown when clicking a whale) -->
  <div id="wh-detail" style="display:none" class="form-box">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 id="wh-det-title">Whale Detail</h3>
      <button class="btn btn-sm" id="wh-det-close" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:12px;padding:6px 14px;border-radius:6px;cursor:pointer">← Back</button>
    </div>
    <div class="summary-row" id="wh-det-stats" style="margin-bottom:16px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div><h4 style="font-size:13px;color:var(--muted);margin-bottom:8px">Score Breakdown</h4><div id="wh-det-score"></div></div>
      <div><h4 style="font-size:13px;color:var(--muted);margin-bottom:8px">Equity Curve</h4><div id="wh-det-equity" style="height:140px;position:relative;overflow:hidden"></div></div>
    </div>
    <h4 style="font-size:13px;color:var(--muted);margin-bottom:8px">Recent Trades</h4>
    <div class="wallet-table"><table>
      <thead><tr><th>Time</th><th>Market</th><th>Side</th><th>Price</th><th>Size</th><th>Notional</th><th>Slippage</th></tr></thead>
      <tbody id="wh-det-trades"></tbody>
    </table></div>
  </div>
</div>

<!-- ═══════════ CONSOLE TAB ═══════════ -->
<div class="tab-pane" id="pane-console">
  <!-- Sub-tab navigation -->
  <div class="con-sub-tabs">
    <button class="con-sub-tab active" data-cpanel="console-log">📟 Console Log</button>
    <button class="con-sub-tab" data-cpanel="trade-log">📊 Trade Log <span class="tl-live-dot" style="margin-left:4px"></span></button>
  </div>

  <!-- ── Console Log Sub-Panel ── -->
  <div class="con-sub-panel active" id="cpanel-console-log">
    <!-- Toolbar -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <select id="con-level" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:6px 10px;border-radius:6px;font-size:12px">
        <option value="">All Levels</option>
        <option value="DEBUG">DEBUG</option>
        <option value="INFO">INFO</option>
        <option value="WARN">WARN</option>
        <option value="ERROR">ERROR</option>
        <option value="SUCCESS">SUCCESS</option>
      </select>
      <select id="con-cat" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:6px 10px;border-radius:6px;font-size:12px">
        <option value="">All Categories</option>
        <option value="SCAN">SCAN</option>
        <option value="SIGNAL">SIGNAL</option>
        <option value="ORDER">ORDER</option>
        <option value="FILL">FILL</option>
        <option value="POSITION">POSITION</option>
        <option value="RISK">RISK</option>
        <option value="ENGINE">ENGINE</option>
        <option value="STRATEGY">STRATEGY</option>
        <option value="WALLET">WALLET</option>
        <option value="SYSTEM">SYSTEM</option>
        <option value="ERROR">ERROR</option>
      </select>
      <input id="con-search" type="text" placeholder="Search logs…" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:6px 12px;border-radius:6px;font-size:12px;flex:1;min-width:140px">
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);cursor:pointer;user-select:none">
        <input type="checkbox" id="con-autoscroll" checked> Auto-scroll
      </label>
      <button id="con-pause" class="btn" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:12px;padding:5px 12px;border-radius:6px;cursor:pointer">⏸ Pause</button>
      <button id="con-clear" class="btn" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:12px;padding:5px 12px;border-radius:6px;cursor:pointer">🗑 Clear</button>
      <span id="con-count" style="font-size:11px;color:var(--muted)">0 entries</span>
      <span id="con-status" style="font-size:11px;color:var(--green)">● Connected</span>
    </div>
    <!-- Log container -->
    <div id="con-log" style="background:#0a0d10;border:1px solid var(--border);border-radius:8px;font-family:'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace;font-size:12px;line-height:1.65;overflow-y:auto;max-height:calc(100vh - 260px);padding:12px 16px;scroll-behavior:smooth"></div>
    <!-- Stats bar -->
    <div id="con-stats" style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:var(--muted)"></div>
  </div>

  <!-- ── Trade Log Sub-Panel ── -->
  <div class="con-sub-panel" id="cpanel-trade-log">
    <!-- Total PnL Banner -->
    <div class="tl-total-banner">
      <div>
        <div class="tl-total-label">Total Realized PnL (All Wallets)</div>
        <div class="tl-total-pnl pnl-zero" id="tl-total-pnl">$0.00</div>
      </div>
      <div class="tl-stats-row">
        <div class="tl-stat"><div class="label">Total Trades</div><div class="value" id="tl-total-count">0</div></div>
        <div class="tl-stat"><div class="label">Winners</div><div class="value pnl-pos" id="tl-win-count">0</div></div>
        <div class="tl-stat"><div class="label">Losers</div><div class="value pnl-neg" id="tl-loss-count">0</div></div>
        <div class="tl-stat"><div class="label">Volume</div><div class="value" id="tl-volume">$0</div></div>
        <div class="tl-stat"><div class="label">Status</div><div class="value"><span class="tl-live-dot"></span> Live</div></div>
      </div>
    </div>

    <!-- Filters -->
    <div class="tl-toolbar">
      <select id="tl-side-filter">
        <option value="">All Sides</option>
        <option value="BUY">BUY</option>
        <option value="SELL">SELL</option>
      </select>
      <select id="tl-wallet-filter">
        <option value="">All Wallets</option>
      </select>
      <input id="tl-search" type="text" placeholder="Search by market, wallet, or ID…">
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);cursor:pointer;user-select:none">
        <input type="checkbox" id="tl-autoscroll" checked> Auto-scroll
      </label>
      <span id="tl-last-update" style="font-size:11px;color:var(--muted)">—</span>
    </div>

    <!-- Trade table -->
    <div class="tl-table-wrap" id="tl-table-wrap">
      <table class="tl-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Wallet</th>
            <th>Market</th>
            <th>Side</th>
            <th>Outcome</th>
            <th>Price</th>
            <th>Size</th>
            <th>Cost</th>
            <th>Realized PnL</th>
            <th>Cumulative PnL</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody id="tl-tbody"></tbody>
      </table>
    </div>
    <div class="tl-empty" id="tl-empty" style="display:none">
      <div class="icon">📊</div>
      <div>No trades recorded yet. Trades will appear here in real-time as your strategies execute.</div>
    </div>

    <!-- Footer -->
    <div class="tl-footer">
      <span id="tl-showing">Showing 0 trades</span>
      <span>Refreshes every 2s &middot; Sorted newest first</span>
    </div>
  </div>
</div>

</div><!-- /main -->

<footer>Real-time SSE stream at /api/stream &middot; JSON API at /api/data &middot; Wallet API at /api/wallets &middot; Trades at /api/trades/all | /api/trades/:walletId &middot; Strategy catalog at /api/strategies &middot; Whale API at /api/whales/* &middot; Console SSE at /api/console/stream</footer>

<script>
/* ─── State ─── */
let currentData = null;
let strategies = [];
let walletList = [];

async function triggerKillSwitch(){
  const ok = confirm('Kill Switch will attempt to exit ALL open positions, then stop the bot. Continue?');
  if(!ok) return;

  const btn = document.getElementById('kill-switch-btn');
  if(btn){
    btn.disabled = true;
    btn.textContent = 'Killing...';
  }

  try{
    const r = await fetch('/api/kill-switch', { method: 'POST' });
    const j = await r.json();
    if(!j.ok){
      alert('Kill Switch failed: ' + (j.error || 'unknown error'));
      if(btn){
        btn.disabled = false;
        btn.textContent = 'Kill Switch';
      }
      return;
    }
    alert('Kill Switch succeeded. Bot is stopping now.');
  }catch(e){
    alert('Kill Switch request failed. Check server logs.');
    if(btn){
      btn.disabled = false;
      btn.textContent = 'Kill Switch';
    }
  }
}

/* ─── Tab switching ─── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pane-' + btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='markets') loadMarkets();
    if(btn.dataset.tab==='whales') loadWhales();
  });
});

/* ─── Helpers ─── */
const $ = s => document.querySelector(s);
const fmt = (v,d=2) => Number(v).toFixed(d);
const pct = v => (v*100).toFixed(1)+'%';
function pnlCls(v){return v>0?'pnl-pos':v<0?'pnl-neg':'pnl-zero'}
function barCls(r){return r<.6?'bar-ok':r<.85?'bar-warn':'bar-danger'}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
const marketSlugCache=new Map();
let marketSlugCacheLoadedAt=0;
const MARKET_SLUG_CACHE_TTL_MS=120000;
function rememberMarketSlug(marketId, slug){
  if(!marketId || !slug) return;
  marketSlugCache.set(String(marketId), String(slug));
}
function getCachedMarketSlug(marketId){
  return marketSlugCache.get(String(marketId));
}
async function refreshMarketSlugCache(force){
  const now=Date.now();
  if(!force && now-marketSlugCacheLoadedAt<MARKET_SLUG_CACHE_TTL_MS) return;
  try{
    const r=await fetch('/api/markets');
    if(!r.ok) return;
    const markets=await r.json();
    if(!Array.isArray(markets)) return;
    for(const m of markets){
      if(m&&m.marketId&&m.slug){
        rememberMarketSlug(m.marketId,m.slug);
      }
    }
    marketSlugCacheLoadedAt=now;
  }catch(e){
    console.warn('refreshMarketSlugCache failed',e);
  }
}
function polyEventUrl(marketId, slug){
  const resolvedSlug=(slug&&String(slug).trim().length>0)
    ? String(slug).trim()
    : getCachedMarketSlug(marketId);
  if(resolvedSlug && String(resolvedSlug).trim().length>0){
    return 'https://polymarket.com/event/'+encodeURIComponent(String(resolvedSlug).trim());
  }
  return 'https://polymarket.com/search?q='+encodeURIComponent(String(marketId));
}
function polyTradesUrl(marketId){
  return 'https://clob.polymarket.com/trades?market='+encodeURIComponent(String(marketId));
}
function renderPolyLinks(marketId, slug){
  return '<a class="ext-link" href="'+polyEventUrl(marketId,slug)+'" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Event ↗</a>'+
    '<a class="ext-link ext-link-muted" href="'+polyTradesUrl(marketId)+'" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Trades ↗</a>';
}

/* ─── Dashboard Tab ─── */
function renderSummary(d){
  const rPnl = d.totalRealizedPnl || d.totalPnl || 0;
  const uPnl = d.totalUnrealizedPnl || 0;
  const tPnl = d.totalPnl || 0;
  $('#summary').innerHTML=
    '<div class="s-card"><div class="label">Active Wallets</div><div class="value">'+d.activeWallets+'</div></div>'+
    '<div class="s-card"><div class="label">Total Capital</div><div class="value">$'+fmt(d.totalCapital,0)+'</div></div>'+
    '<div class="s-card"><div class="label">Realized PnL</div><div class="value '+pnlCls(rPnl)+'">$'+fmt(rPnl)+'</div></div>'+
    '<div class="s-card"><div class="label">Unrealized PnL</div><div class="value '+pnlCls(uPnl)+'">$'+fmt(uPnl)+'</div></div>'+
    '<div class="s-card"><div class="label">Total PnL</div><div class="value '+pnlCls(tPnl)+'">$'+fmt(tPnl)+'</div></div>'+
    '<div class="s-card"><div class="label">Engine Status</div><div class="value" style="font-size:16px;color:var(--green)">RUNNING</div></div>';
}

function renderExecutionHealth(exec){
  if(!window.__executionHealthTrend){
    window.__executionHealthTrend={lastRouteP95:null,lastSubmitP95:null};
  }
  const trend=window.__executionHealthTrend;
  const container=document.getElementById('execution-health');
  if(!container) return;
  if(!exec){
    container.innerHTML='';
    return;
  }

  const routeFailRate=exec.routeAttempts>0?((exec.routeFailures/exec.routeAttempts)*100):0;
  const submitFailRate=exec.submitAttempts>0?((exec.submitFailures/exec.submitAttempts)*100):0;
  const routeAvg=Number(exec.routeLatencyAvgMs||0);
  const routeRecentAvg=Number(exec.routeLatencyRecentAvgMs||0);
  const routeP95=Number(exec.routeLatencyP95Ms||0);
  const submitAvg=Number(exec.submitLatencyAvgMs||0);
  const submitRecentAvg=Number(exec.submitLatencyRecentAvgMs||0);
  const submitP95=Number(exec.submitLatencyP95Ms||0);
  const routeP95Delta=trend.lastRouteP95===null?null:(routeP95-Number(trend.lastRouteP95));
  const submitP95Delta=trend.lastSubmitP95===null?null:(submitP95-Number(trend.lastSubmitP95));
  trend.lastRouteP95=routeP95;
  trend.lastSubmitP95=submitP95;
  const now=Date.now();
  const routeLastAgeSec=exec.routeLastLatencyAtMs>0?Math.max(0,Math.floor((now-Number(exec.routeLastLatencyAtMs))/1000)):null;
  const submitLastAgeSec=exec.submitLastLatencyAtMs>0?Math.max(0,Math.floor((now-Number(exec.submitLastLatencyAtMs))/1000)):null;

  container.innerHTML=
    '<div class="s-card"><div class="label">Route Attempts</div><div class="value">'+exec.routeAttempts+'</div></div>'+
    '<div class="s-card"><div class="label">Route Fail Rate</div><div class="value '+(routeFailRate>10?'pnl-neg':'pnl-pos')+'">'+routeFailRate.toFixed(1)+'%</div></div>'+
    '<div class="s-card"><div class="label">Submit Timeouts</div><div class="value '+(exec.submitTimeouts>0?'pnl-neg':'pnl-pos')+'">'+exec.submitTimeouts+'</div></div>'+
    '<div class="s-card"><div class="label">Route Latency Avg / P95</div><div class="value">'+routeAvg.toFixed(1)+' / '+routeP95.toFixed(1)+' ms</div><div class="'+(routeP95Delta!==null&&routeP95Delta>0?'pnl-neg':'pnl-pos')+'" style="font-size:11px">Δ '+(routeP95Delta===null?'n/a':(routeP95Delta>=0?'+':'')+routeP95Delta.toFixed(1)+' ms')+'</div></div>'+
    '<div class="s-card"><div class="label">Submit Latency Avg / P95</div><div class="value">'+submitAvg.toFixed(1)+' / '+submitP95.toFixed(1)+' ms</div><div class="'+(submitP95Delta!==null&&submitP95Delta>0?'pnl-neg':'pnl-pos')+'" style="font-size:11px">Δ '+(submitP95Delta===null?'n/a':(submitP95Delta>=0?'+':'')+submitP95Delta.toFixed(1)+' ms')+'</div></div>'+
    '<div class="s-card"><div class="label">Route Recent Avg</div><div class="value">'+routeRecentAvg.toFixed(1)+' ms</div></div>'+
    '<div class="s-card"><div class="label">Submit Recent Avg</div><div class="value">'+submitRecentAvg.toFixed(1)+' ms</div></div>'+
    '<div class="s-card"><div class="label">Route Last Sample</div><div class="value">'+(routeLastAgeSec===null?'n/a':routeLastAgeSec+'s ago')+'</div></div>'+
    '<div class="s-card"><div class="label">Submit Last Sample</div><div class="value">'+(submitLastAgeSec===null?'n/a':submitLastAgeSec+'s ago')+'</div></div>'+
    '<div class="s-card"><div class="label">Submit Fail Rate</div><div class="value '+(submitFailRate>10?'pnl-neg':'pnl-pos')+'">'+submitFailRate.toFixed(1)+'%</div></div>';
}

async function fetchRuntimeCounters(){
  try{
    const r=await fetch('/api/system/counters');
    if(!r.ok) return;
    const counters=await r.json();
    renderExecutionHealth(counters.execution);
  }catch(e){
    console.error('fetchRuntimeCounters error',e);
  }
}

function renderWallets(wl){
  $('#wallets').innerHTML=wl.map(w=>{
    const p=w.performance;
    const capUsed=w.capitalAllocated-w.availableBalance;
    const capR=Math.min(1,capUsed/Math.max(1,w.capitalAllocated));
    const lossR=Math.min(1,Math.abs(Math.min(0,w.realizedPnl))/w.riskLimits.maxDailyLoss);
    const trR=Math.min(1,w.openPositions.length/w.riskLimits.maxOpenTrades);
    const uPnl = w.unrealizedPnl || 0;
    const tPnl = w.totalPnl || w.realizedPnl;
    const isPaused = w.paused || false;
    const toggleCls = isPaused ? 'paused' : 'running';
    const toggleLabel = isPaused ? '\u25B6 Start' : '\u23F8 Running';
    const dName = w.displayName || w.walletId;

    /* ── Top 10 positions by total PnL ── */
    let posHtml='';
    if(w.openPositions.length>0){
      const sorted=w.openPositions.slice().map(pos=>{
        const up=pos.unrealizedPnl||0;
        return {...pos, totalPnl: pos.realizedPnl+up};
      }).sort((a,b)=>b.totalPnl-a.totalPnl);
      const top10=sorted.slice(0,10);
      const showing=top10.length;
      const total=w.openPositions.length;
      posHtml='<div class="pos-sec"><div class="pos-title">\uD83D\uDCCA Top Positions'+(total>showing?' <span style="font-size:10px;color:var(--muted);font-weight:400">('+showing+' of '+total+')</span>':'')+'</div>'+
        '<div class="pos-list">'+top10.map(pos=>{
          const up=pos.unrealizedPnl||0;
          const tp=pos.realizedPnl+up;
          return '<div class="pos-row"><div class="pos-mkt" title="'+pos.marketId+'">'+pos.marketId.slice(0,20)+(pos.marketId.length>20?'…':'')+'<div class="ext-link-row">'+renderPolyLinks(pos.marketId)+'</div></div>'+
            '<div class="pos-out o-'+pos.outcome+'">'+pos.outcome+'</div>'+
            '<div class="pos-sz">×'+fmt(pos.size,1)+'</div>'+
            '<div class="pos-pnl '+pnlCls(tp)+'">$'+fmt(tp)+'</div></div>';
        }).join('')+'</div></div>';
    }

    return '<div class="w-card" style="cursor:pointer" onclick="openWalletDetail(\\''+w.walletId+'\\')" title="Click for detailed analytics">'+
      '<div class="w-hdr"><div class="w-left"><span class="w-id">'+dName+'</span><span class="w-strat">'+w.strategy+'</span></div><div style="display:flex;align-items:center;gap:8px"><button class="toggle-btn '+toggleCls+'" onclick="event.stopPropagation();toggleWallet(\\''+w.walletId+'\\','+isPaused+')" title="'+(isPaused?'Start':'Pause')+' this wallet"><span class="toggle-dot"></span>'+toggleLabel+'</button><span class="badge badge-'+w.mode+'">'+w.mode+'</span></div></div>'+
      '<div class="w-body"><div class="m-row">'+
      '<div class="m-cell"><div class="m-label">Capital</div><div class="m-val">$'+fmt(w.capitalAllocated,0)+'</div></div>'+
      '<div class="m-cell"><div class="m-label">Available</div><div class="m-val">$'+fmt(w.availableBalance,0)+'</div></div>'+
      '<div class="m-cell"><div class="m-label">Realized</div><div class="m-val '+pnlCls(p.realizedPnl)+'">$'+fmt(p.realizedPnl)+'</div></div>'+
      '<div class="m-cell"><div class="m-label">Unrealized</div><div class="m-val '+pnlCls(uPnl)+'">$'+fmt(uPnl)+'</div></div>'+
      '<div class="m-cell"><div class="m-label">Total PnL</div><div class="m-val '+pnlCls(tPnl)+'">$'+fmt(tPnl)+'</div></div>'+
      '<div class="m-cell"><div class="m-label">Win Rate</div><div class="m-val">'+(p.totalTrades>0?pct(p.winRate):'N/A')+'</div></div>'+
      '<div class="m-cell"><div class="m-label">Trades</div><div class="m-val">'+p.totalTrades+' <span style="font-size:10px;color:var(--muted)">('+p.winCount+'W/'+p.lossCount+'L)</span></div></div>'+
      '<div class="m-cell"><div class="m-label">Profit Factor</div><div class="m-val">'+(p.profitFactor>=999?'\u221E':fmt(p.profitFactor,1))+'</div></div></div>'+
      '<div class="risk-sec"><div class="r-title">Risk Utilization</div><div class="risk-bars">'+
      '<div class="rb-row"><span class="rb-label">Capital Used</span><div class="rb-track"><div class="rb-fill '+barCls(capR)+'" style="width:'+(capR*100).toFixed(1)+'%"></div></div><span class="rb-val">'+pct(capR)+'</span></div>'+
      '<div class="rb-row"><span class="rb-label">Daily Loss</span><div class="rb-track"><div class="rb-fill '+barCls(lossR)+'" style="width:'+(lossR*100).toFixed(1)+'%"></div></div><span class="rb-val">'+pct(lossR)+'</span></div>'+
      '<div class="rb-row"><span class="rb-label">Open Trades</span><div class="rb-track"><div class="rb-fill '+barCls(trR)+'" style="width:'+(trR*100).toFixed(1)+'%"></div></div><span class="rb-val">'+w.openPositions.length+'/'+w.riskLimits.maxOpenTrades+'</span></div>'+
      '</div></div>'+
      posHtml+
      '</div></div>';
  }).join('');
}

/* ─── Toggle wallet start/stop ─── */
async function toggleWallet(walletId, isPaused){
  const action = isPaused ? 'resume' : 'pause';
  try{
    const r=await fetch('/api/wallets/'+encodeURIComponent(walletId)+'/'+action,{method:'POST'});
    const j=await r.json();
    if(!j.ok) console.error('Toggle failed:',j.error);
  }catch(e){console.error('Toggle error',e)}
}

/* ─── Wallet Detail Overlay ─── */
let walletDetailId = null;
let walletDetailInterval = null;
let wdActiveTab = 'overview';

async function openWalletDetail(walletId){
  try{
    const r=await fetch('/api/wallets/'+encodeURIComponent(walletId)+'/detail');
    if(!r.ok){alert('Wallet not found');return}
    const d=await r.json();
    walletDetailId = walletId;
    wdActiveTab = 'overview';
    renderWalletDetail(d);
    document.getElementById('wallet-detail-overlay').classList.add('active');
    // Auto-refresh wallet detail every 2s
    if(walletDetailInterval) clearInterval(walletDetailInterval);
    walletDetailInterval = setInterval(async()=>{
      try{
        const rr=await fetch('/api/wallets/'+encodeURIComponent(walletDetailId)+'/detail');
        if(rr.ok){renderWalletDetail(await rr.json())}
      }catch(e){}
    }, 2000);
  }catch(e){console.error(e);alert('Failed to load wallet detail')}
}
function closeWalletDetail(){
  walletDetailId = null;
  if(walletDetailInterval){clearInterval(walletDetailInterval);walletDetailInterval=null}
  document.getElementById('wallet-detail-overlay').classList.remove('active');
}

let lastWalletDetailData = null;

function switchWdTab(tab){
  wdActiveTab = tab;
  document.querySelectorAll('.wd-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.wd-tab-panel').forEach(p=>p.classList.toggle('active',p.id==='wdp-'+tab));
}

function renderWalletDetail(d){
  lastWalletDetailData = d;
  const w=d.wallet, s=d.stats, r=d.risk;
  const dName = w.displayName || w.walletId;
  const isPaused = w.paused || false;
  document.getElementById('wd-title').textContent=dName+' \u2014 '+w.strategy+' ('+w.mode+')';

  let html='';

  /* ── Status bar ── */
  const stCls = isPaused ? 'paused' : 'running';
  const stText = isPaused ? 'PAUSED' : 'RUNNING';
  html+='<div class="wd-status-bar">'+
    '<div class="wd-status-indicator '+stCls+'"></div>'+
    '<div class="wd-status-text">'+stText+'<span class="sub">'+w.strategy+' \u00B7 '+w.mode+' \u00B7 $'+fmt(w.capitalAllocated,0)+' capital</span></div>'+
    '<button class="toggle-btn '+stCls+'" onclick="toggleWalletFromDetail(\\''+w.walletId+'\\','+isPaused+')"><span class="toggle-dot"></span>'+(isPaused?'\u25B6 Start':'\u23F8 Pause')+'</button>'+
    '</div>';

  /* ── Tabs ── */
  html+='<div class="wd-tabs">'+
    '<button class="wd-tab'+(wdActiveTab==='overview'?' active':'')+'" data-tab="overview" onclick="switchWdTab(\\'overview\\')">Overview</button>'+
    '<button class="wd-tab'+(wdActiveTab==='positions'?' active':'')+'" data-tab="positions" onclick="switchWdTab(\\'positions\\')">Positions ('+w.openPositions.length+')</button>'+
    '<button class="wd-tab'+(wdActiveTab==='trades'?' active':'')+'" data-tab="trades" onclick="switchWdTab(\\'trades\\')">Trade History ('+d.tradeHistory.length+')</button>'+
    '<button class="wd-tab'+(wdActiveTab==='settings'?' active':'')+'" data-tab="settings" onclick="switchWdTab(\\'settings\\')">Settings</button>'+
    '</div>';

  /* ═══ TAB: Overview ═══ */
  html+='<div id="wdp-overview" class="wd-tab-panel'+(wdActiveTab==='overview'?' active':'')+'">';

  /* Summary stats */
  html+='<div class="wd-summary">';
  const uPnl = w.openPositions.reduce((s,p) => s + (p.unrealizedPnl||0), 0);
  const tPnl = w.realizedPnl + uPnl;
  const stats=[
    ['Capital','$'+fmt(w.capitalAllocated,0),''],
    ['Available','$'+fmt(w.availableBalance),''],
    ['Realized PnL','$'+fmt(w.realizedPnl),pnlCls(w.realizedPnl)],
    ['Unrealized PnL','$'+fmt(uPnl),pnlCls(uPnl)],
    ['Total PnL','$'+fmt(tPnl),pnlCls(tPnl)],
    ['ROI',pct(tPnl/Math.max(1,w.capitalAllocated)),pnlCls(tPnl)],
    ['Total Trades',s.totalTrades,''],
    ['Buys / Sells',s.buyTrades+' / '+s.sellTrades,''],
    ['Closed Trades',s.closedTrades,''],
    ['Win Rate',s.closedTrades>0?pct(s.winRate):'N/A',s.winRate>=0.5?'pnl-pos':'pnl-neg'],
    ['Avg Win','$'+fmt(s.avgWin),'pnl-pos'],
    ['Avg Loss','$'+fmt(Math.abs(s.avgLoss)),'pnl-neg'],
    ['Profit Factor',s.profitFactor==='Infinity'?'\\u221E':fmt(s.profitFactor,1),''],
    ['Max Drawdown','$'+fmt(s.maxDrawdown)+' ('+pct(s.maxDrawdownPct)+')','pnl-neg'],
    ['Largest Win','$'+fmt(s.largestWin),'pnl-pos'],
    ['Largest Loss','$'+fmt(Math.abs(s.largestLoss)),'pnl-neg'],
    ['Win Streak',s.longestWinStreak,''],
    ['Loss Streak',s.longestLossStreak,''],
    ['Current Streak',(s.currentStreak>0?'+':'')+s.currentStreak,s.currentStreak>0?'pnl-pos':s.currentStreak<0?'pnl-neg':''],
  ];
  for(const[label,value,cls] of stats){
    html+='<div class="wd-stat"><div class="label">'+label+'</div><div class="value '+(cls||'')+'">'+value+'</div></div>';
  }
  html+='</div>';

  /* Charts row */
  html+='<div class="wd-2col">';
  html+='<div class="wd-section"><h3>\uD83D\uDCC8 Cumulative PnL</h3><div class="wd-chart" id="wd-pnl-chart"></div></div>';
  html+='<div class="wd-section"><h3>\uD83D\uDCC9 Drawdown</h3><div class="wd-chart" id="wd-dd-chart"></div></div>';
  html+='</div>';

  /* Risk utilization */
  html+='<div class="wd-section"><h3>\uD83D\uDEE1 Risk Utilization</h3><div class="wd-risk-bars">';
  const risks=[
    ['Capital Utilization',r.capitalUtilization],
    ['Daily Loss Limit',r.dailyLossUtilization],
    ['Open Trade Slots',r.openTradeUtilization],
  ];
  for(const[label,val] of risks){
    const cls=val<0.6?'bar-ok':val<0.85?'bar-warn':'bar-danger';
    html+='<div class="wd-rb"><span class="lbl">'+label+'</span><div class="track"><div class="fill '+cls+'" style="width:'+(val*100).toFixed(1)+'%"></div></div><span class="val">'+pct(val)+'</span></div>';
  }
  html+='</div></div>';
  html+='</div>'; /* /overview */

  /* ═══ TAB: Positions ═══ */
  html+='<div id="wdp-positions" class="wd-tab-panel'+(wdActiveTab==='positions'?' active':'')+'">';

  /* Open positions (clickable) */
  if(w.openPositions.length>0){
    html+='<div class="wd-section"><h3>\uD83D\uDCCA Open Positions ('+w.openPositions.length+') <span style="font-size:11px;color:var(--accent);font-weight:400;margin-left:8px">Click a row for details</span></h3>';
    html+='<table class="wd-mkt-table"><thead><tr><th>Market ID</th><th>Outcome</th><th>Size</th><th>Avg Price</th><th>Realized PnL</th><th>Unrealized PnL</th><th>Total PnL</th></tr></thead><tbody>';
    for(let i=0;i<w.openPositions.length;i++){
      const p=w.openPositions[i];
      const upnl = p.unrealizedPnl||0;
      const tpnl = p.realizedPnl + upnl;
      html+='<tr class="clickable-row" onclick="drillPosition('+i+')"><td style="font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis" title="'+p.marketId+'">'+escHtml(p.marketId)+'<div class="ext-link-row">'+renderPolyLinks(p.marketId)+'</div></td><td class="o-'+p.outcome+'">'+p.outcome+'</td><td>'+fmt(p.size,1)+'</td><td>$'+fmt(p.avgPrice,4)+'</td><td class="'+pnlCls(p.realizedPnl)+'">$'+fmt(p.realizedPnl)+'</td><td class="'+pnlCls(upnl)+'">$'+fmt(upnl)+'</td><td class="'+pnlCls(tpnl)+'">$'+fmt(tpnl)+'</td></tr>';
    }
    html+='</tbody></table></div>';
  }else{
    html+='<div class="wd-section"><h3>\uD83D\uDCCA Open Positions</h3><p class="empty">No open positions. The strategy is scanning markets.</p></div>';
  }

  /* Per-market breakdown (clickable) */
  if(d.marketBreakdown.length>0){
    html+='<div class="wd-section"><h3>\uD83C\uDFAF Per-Market Breakdown ('+d.marketBreakdown.length+' markets) <span style="font-size:11px;color:var(--accent);font-weight:400;margin-left:8px">Click a row for details</span></h3>';
    html+='<table class="wd-mkt-table"><thead><tr><th>Market</th><th>Outcome</th><th>Trades</th><th>Buy Vol</th><th>Sell Vol</th><th>Avg Entry</th><th>Avg Exit</th><th>PnL</th></tr></thead><tbody>';
    for(let i=0;i<d.marketBreakdown.length;i++){
      const m=d.marketBreakdown[i];
      html+='<tr class="clickable-row" onclick="drillMarket('+i+')"><td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">'+escHtml(m.marketId)+'<div class="ext-link-row">'+renderPolyLinks(m.marketId)+'</div></td><td class="o-'+m.outcome+'">'+m.outcome+'</td><td>'+m.trades+'</td><td>$'+fmt(m.buyVolume)+'</td><td>$'+fmt(m.sellVolume)+'</td><td>$'+fmt(m.avgEntryPrice,4)+'</td><td>$'+fmt(m.avgExitPrice,4)+'</td><td class="'+pnlCls(m.realizedPnl)+'">$'+fmt(m.realizedPnl)+'</td></tr>';
    }
    html+='</tbody></table></div>';
  }
  html+='</div>'; /* /positions */

  /* ═══ TAB: Trade History ═══ */
  html+='<div id="wdp-trades" class="wd-tab-panel'+(wdActiveTab==='trades'?' active':'')+'">';
  html+='<div class="wd-section"><h3>\uD83D\uDCDD Trade History ('+d.tradeHistory.length+' trades) <span style="font-size:11px;color:var(--accent);font-weight:400;margin-left:8px">Click a row for details</span></h3>';
  if(d.tradeHistory.length>0){
    const reversed=d.tradeHistory.slice().reverse();
    html+='<div style="max-height:600px;overflow-y:auto"><table class="wd-trades-table"><thead><tr><th>Time</th><th>Market</th><th>Side</th><th>Outcome</th><th>Price</th><th>Size</th><th>Cost</th><th>PnL</th><th>Cum. PnL</th><th>Balance</th></tr></thead><tbody>';
    for(let i=0;i<reversed.length;i++){
      const t=reversed[i];
      const ts=new Date(t.timestamp).toLocaleString();
      html+='<tr class="clickable-row" onclick="drillTrade('+i+')"><td style="font-size:10px;white-space:nowrap">'+ts+'</td><td style="font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis" title="'+t.marketId+'">'+escHtml(t.marketId)+'<div class="ext-link-row">'+renderPolyLinks(t.marketId)+'</div></td><td style="font-weight:700;color:'+(t.side==='BUY'?'var(--green)':'var(--red)')+'">'+t.side+'</td><td class="o-'+t.outcome+'">'+t.outcome+'</td><td>$'+fmt(t.price,4)+'</td><td>'+fmt(t.size,1)+'</td><td>$'+fmt(t.cost)+'</td><td class="'+pnlCls(t.realizedPnl)+'">$'+fmt(t.realizedPnl)+'</td><td class="'+pnlCls(t.cumulativePnl)+'">$'+fmt(t.cumulativePnl)+'</td><td>$'+fmt(t.balanceAfter)+'</td></tr>';
    }
    html+='</tbody></table></div>';
  }else{
    html+='<p class="empty">No trades yet. The strategy is scanning markets and will place trades when it finds opportunities.</p>';
  }
  html+='</div>';
  html+='</div>'; /* /trades */

  /* ═══ TAB: Settings ═══ */
  html+='<div id="wdp-settings" class="wd-tab-panel'+(wdActiveTab==='settings'?' active':'')+'">';

  /* Wallet Identity */
  html+='<div class="ws-section"><h3>\u270F\uFE0F Wallet Identity</h3>'+
    '<div class="ws-form-grid">'+
    '<div class="ws-field"><label>Wallet ID</label><input type="text" value="'+w.walletId+'" disabled><div class="hint">Internal identifier (cannot be changed)</div></div>'+
    '<div class="ws-field"><label>Display Name</label><input type="text" id="ws-display-name" value="'+dName+'" placeholder="Enter a friendly name"></div>'+
    '<div class="ws-field"><label>Strategy</label><input type="text" value="'+w.strategy+'" disabled><div class="hint">Strategy cannot be changed after creation</div></div>'+
    '<div class="ws-field"><label>Mode</label><input type="text" value="'+w.mode+'" disabled><div class="hint">Trading mode (PAPER / LIVE)</div></div>'+
    '</div>'+
    '<div class="ws-actions"><button class="btn" onclick="saveWalletName(\\''+w.walletId+'\\')">Save Name</button><span id="ws-name-msg" class="ws-msg" style="display:none"></span></div>'+
    '</div>';

  /* Risk Limits */
  const rl = w.riskLimits;
  html+='<div class="ws-section"><h3>\uD83D\uDEE1 Risk Limits</h3>'+
    '<div class="ws-form-grid">'+
    '<div class="ws-field"><label>Max Position Size ($)</label><input type="number" id="ws-rl-maxPositionSize" value="'+rl.maxPositionSize+'" min="0" step="10"><div class="hint">Maximum dollar size per position</div></div>'+
    '<div class="ws-field"><label>Max Exposure Per Market ($)</label><input type="number" id="ws-rl-maxExposurePerMarket" value="'+rl.maxExposurePerMarket+'" min="0" step="10"><div class="hint">Maximum exposure to any single market</div></div>'+
    '<div class="ws-field"><label>Max Daily Loss ($)</label><input type="number" id="ws-rl-maxDailyLoss" value="'+rl.maxDailyLoss+'" min="0" step="10"><div class="hint">Kill switch threshold for daily losses</div></div>'+
    '<div class="ws-field"><label>Max Open Trades</label><input type="number" id="ws-rl-maxOpenTrades" value="'+rl.maxOpenTrades+'" min="1" step="1"><div class="hint">Maximum concurrent open positions</div></div>'+
    '<div class="ws-field"><label>Max Drawdown (%)</label><input type="number" id="ws-rl-maxDrawdown" value="'+(rl.maxDrawdown*100).toFixed(1)+'" min="0" max="100" step="0.5"><div class="hint">Maximum portfolio drawdown percentage</div></div>'+
    '</div>'+
    '<div class="ws-actions"><button class="btn" onclick="saveRiskLimits(\\''+w.walletId+'\\')">Save Risk Limits</button><span id="ws-risk-msg" class="ws-msg" style="display:none"></span></div>'+
    '</div>';

  /* Wallet Performance Summary (read-only) */
  html+='<div class="ws-section"><h3>\uD83D\uDCCA Performance Snapshot</h3>'+
    '<div class="ws-form-grid">'+
    '<div class="ws-field"><label>Capital Allocated</label><input type="text" value="$'+fmt(w.capitalAllocated,2)+'" disabled></div>'+
    '<div class="ws-field"><label>Available Balance</label><input type="text" value="$'+fmt(w.availableBalance,2)+'" disabled></div>'+
    '<div class="ws-field"><label>Realized PnL</label><input type="text" value="$'+fmt(w.realizedPnl,4)+'" disabled style="color:'+(w.realizedPnl>=0?'var(--green)':'var(--red)')+'"></div>'+
    '<div class="ws-field"><label>Open Positions</label><input type="text" value="'+w.openPositions.length+'" disabled></div>'+
    '<div class="ws-field"><label>Total Trades</label><input type="text" value="'+s.totalTrades+'" disabled></div>'+
    '<div class="ws-field"><label>Win Rate</label><input type="text" value="'+(s.closedTrades>0?pct(s.winRate):'N/A')+'" disabled></div>'+
    '</div></div>';

  /* Danger Zone */
  html+='<div class="ws-danger"><h3>\u26A0\uFE0F Danger Zone</h3>'+
    '<p>Permanently remove this wallet and all its data. This action cannot be undone.</p>'+
    '<button class="btn btn-danger" onclick="deleteWalletFromDetail(\\''+w.walletId+'\\')">Delete Wallet</button>'+
    '</div>';

  html+='</div>'; /* /settings */

  /* Preserve editable settings field values and focused element across re-renders
     so the 2s auto-refresh does not wipe out what the user is typing. */
  const _sfIds=['ws-display-name','ws-rl-maxPositionSize','ws-rl-maxExposurePerMarket','ws-rl-maxDailyLoss','ws-rl-maxOpenTrades','ws-rl-maxDrawdown'];
  const _sfVals={};
  const _sfFocusId=document.activeElement&&document.activeElement.id||null;
  for(const id of _sfIds){const el=document.getElementById(id);if(el)_sfVals[id]=el.value;}

  document.getElementById('wd-content').innerHTML=html;

  for(const id of _sfIds){const el=document.getElementById(id);if(el&&_sfVals[id]!==undefined)el.value=_sfVals[id];}
  if(_sfFocusId){const fe=document.getElementById(_sfFocusId);if(fe)fe.focus();}

  /* ── Render SVG charts (only if overview tab is active) ── */
  if(wdActiveTab==='overview'){
    if(d.pnlTimeline.length>1){
      renderSvgLine('wd-pnl-chart',d.pnlTimeline.map(p=>p.pnl),'PnL',true);
    }else{
      const el=document.getElementById('wd-pnl-chart');
      if(el) el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12px">No trade data yet</div>';
    }
    if(d.drawdownTimeline.length>1){
      renderSvgLine('wd-dd-chart',d.drawdownTimeline.map(p=>-p.drawdown),'Drawdown',true);
    }else{
      const el=document.getElementById('wd-dd-chart');
      if(el) el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12px">No trade data yet</div>';
    }
  }
}

/* ─── Settings save functions ─── */
async function toggleWalletFromDetail(walletId, isPaused){
  const action = isPaused ? 'resume' : 'pause';
  try{
    const r=await fetch('/api/wallets/'+encodeURIComponent(walletId)+'/'+action,{method:'POST'});
    const j=await r.json();
    if(!j.ok) console.error('Toggle failed:',j.error);
  }catch(e){console.error('Toggle error',e)}
}

async function saveWalletName(walletId){
  const name=document.getElementById('ws-display-name').value.trim();
  if(!name){showWsMsg('ws-name-msg','err','Name cannot be empty');return}
  try{
    const r=await fetch('/api/wallets/'+encodeURIComponent(walletId),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:name})});
    const j=await r.json();
    showWsMsg('ws-name-msg',j.ok?'ok':'err',j.message||j.error);
  }catch(e){showWsMsg('ws-name-msg','err','Network error')}
}

async function saveRiskLimits(walletId){
  const rl={};
  const fields=['maxPositionSize','maxExposurePerMarket','maxDailyLoss','maxOpenTrades','maxDrawdown'];
  for(const f of fields){
    const el=document.getElementById('ws-rl-'+f);
    if(el){
      let v=parseFloat(el.value);
      if(isNaN(v)||v<0){showWsMsg('ws-risk-msg','err','Invalid value for '+f);return}
      if(f==='maxDrawdown') v=v/100; /* convert % to decimal */
      rl[f]=v;
    }
  }
  try{
    const r=await fetch('/api/wallets/'+encodeURIComponent(walletId),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({riskLimits:rl})});
    const j=await r.json();
    showWsMsg('ws-risk-msg',j.ok?'ok':'err',j.message||j.error);
  }catch(e){showWsMsg('ws-risk-msg','err','Network error')}
}

async function deleteWalletFromDetail(walletId){
  if(!confirm('Delete wallet "'+walletId+'"? This cannot be undone.'))return;
  try{
    const r=await fetch('/api/wallets/'+encodeURIComponent(walletId),{method:'DELETE'});
    const j=await r.json();
    if(j.ok){closeWalletDetail();refresh()}
    else{alert(j.error||'Failed to delete')}
  }catch(e){alert('Network error')}
}

function showWsMsg(id,type,msg){
  const el=document.getElementById(id);
  if(!el)return;
  el.textContent=msg;
  el.className='ws-msg '+type;
  el.style.display='inline-block';
  setTimeout(()=>{el.style.display='none'},4000);
}

function renderSvgLine(containerId,data,label,showZero){
  const el=document.getElementById(containerId);
  if(!el||data.length<2)return;
  const W=el.clientWidth||600,H=el.clientHeight||200;
  const pad={t:20,r:20,b:25,l:55};
  const w=W-pad.l-pad.r,h=H-pad.t-pad.b;
  let mn=Math.min(...data),mx=Math.max(...data);
  if(showZero){mn=Math.min(mn,0);mx=Math.max(mx,0)}
  if(mn===mx){mn-=1;mx+=1}
  const xScale=i=>pad.l+(i/(data.length-1))*w;
  const yScale=v=>pad.t+h-(((v-mn)/(mx-mn))*h);
  const pts=data.map((v,i)=>xScale(i)+','+yScale(v)).join(' ');
  const posColor='#00d68f',negColor='#ff4d6a';
  const lastVal=data[data.length-1];
  const color=lastVal>=0?posColor:negColor;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  /* Grid lines */
  const steps=4;
  for(let i=0;i<=steps;i++){
    const v=mn+(mx-mn)*(i/steps);
    const y=yScale(v);
    svg+='<line x1="'+pad.l+'" y1="'+y+'" x2="'+(W-pad.r)+'" y2="'+y+'" stroke="rgba(255,255,255,0.05)" />';
    svg+='<text x="'+(pad.l-8)+'" y="'+(y+4)+'" fill="rgba(255,255,255,0.3)" font-size="9" text-anchor="end">$'+Number(v).toFixed(2)+'</text>';
  }
  /* Zero line */
  if(showZero&&mn<0&&mx>0){
    const zy=yScale(0);
    svg+='<line x1="'+pad.l+'" y1="'+zy+'" x2="'+(W-pad.r)+'" y2="'+zy+'" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4,3" />';
  }
  /* Area fill */
  const areaBase=showZero&&mn<0&&mx>0?yScale(0):(pad.t+h);
  svg+='<polygon points="'+xScale(0)+','+areaBase+' '+pts+' '+xScale(data.length-1)+','+areaBase+'" fill="'+color+'" opacity="0.08" />';
  /* Line */
  svg+='<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linejoin="round" />';
  /* End dot */
  svg+='<circle cx="'+xScale(data.length-1)+'" cy="'+yScale(lastVal)+'" r="4" fill="'+color+'" />';
  /* Label */
  svg+='<text x="'+pad.l+'" y="'+(H-4)+'" fill="rgba(255,255,255,0.3)" font-size="9">'+label+' ('+data.length+' points)</text>';
  svg+='</svg>';
  el.innerHTML=svg;
}

/* ─── Drill-Down Functions ─── */
function openDrillDown(html){
  document.getElementById('wd-drill-content').innerHTML=html;
  document.getElementById('wd-drill-modal').classList.add('active');
}
function closeDrillDown(){
  document.getElementById('wd-drill-modal').classList.remove('active');
}
/* Close drill-down on backdrop click */
document.getElementById('wd-drill-modal').addEventListener('click',function(e){
  if(e.target.id==='wd-drill-modal') closeDrillDown();
});

function drillPosition(idx){
  if(!lastWalletDetailData) return;
  const w=lastWalletDetailData.wallet;
  const p=w.openPositions[idx];
  if(!p) return;
  const upnl=p.unrealizedPnl||0;
  const tpnl=p.realizedPnl+upnl;
  const costBasis=p.avgPrice*p.size;
  const currentValue=costBasis+upnl;
  const returnPct=costBasis>0?((upnl/costBasis)*100).toFixed(2):'0.00';

  /* Find related trades for this market */
  const relatedTrades=lastWalletDetailData.tradeHistory.filter(t=>t.marketId===p.marketId);
  const buys=relatedTrades.filter(t=>t.side==='BUY');
  const sells=relatedTrades.filter(t=>t.side==='SELL');

  /* Find matching market breakdown */
  const mkt=lastWalletDetailData.marketBreakdown.find(m=>m.marketId===p.marketId);

  let h='<div class="wd-drill-title">\uD83D\uDCCA Position Detail</div>';
  h+='<div class="wd-drill-subtitle">'+p.marketId+'</div>';

  h+='<div class="wd-drill-stats">';
  h+='<div class="wd-drill-stat"><div class="label">Outcome</div><div class="value o-'+p.outcome+'">'+p.outcome+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Size</div><div class="value">'+fmt(p.size,1)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Avg Price</div><div class="value">$'+fmt(p.avgPrice,4)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Cost Basis</div><div class="value">$'+fmt(costBasis)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Current Value</div><div class="value">$'+fmt(currentValue)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Realized PnL</div><div class="value '+pnlCls(p.realizedPnl)+'">$'+fmt(p.realizedPnl)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Unrealized PnL</div><div class="value '+pnlCls(upnl)+'">$'+fmt(upnl)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Total PnL</div><div class="value '+pnlCls(tpnl)+'">$'+fmt(tpnl)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Return</div><div class="value '+pnlCls(upnl)+'">'+returnPct+'%</div></div>';
  h+='</div>';

  if(mkt){
    h+='<div style="margin-bottom:16px"><h4 style="font-size:14px;margin-bottom:10px">\uD83C\uDFAF Market Statistics</h4>';
    h+='<div class="wd-drill-stats">';
    h+='<div class="wd-drill-stat"><div class="label">Total Trades</div><div class="value">'+mkt.trades+'</div></div>';
    h+='<div class="wd-drill-stat"><div class="label">Buy Volume</div><div class="value">$'+fmt(mkt.buyVolume)+'</div></div>';
    h+='<div class="wd-drill-stat"><div class="label">Sell Volume</div><div class="value">$'+fmt(mkt.sellVolume)+'</div></div>';
    h+='<div class="wd-drill-stat"><div class="label">Avg Entry</div><div class="value">$'+fmt(mkt.avgEntryPrice,4)+'</div></div>';
    h+='<div class="wd-drill-stat"><div class="label">Avg Exit</div><div class="value">$'+fmt(mkt.avgExitPrice,4)+'</div></div>';
    h+='</div></div>';
  }

  if(relatedTrades.length>0){
    h+='<h4 style="font-size:14px;margin-bottom:10px">\uD83D\uDCDD Trade History for This Market ('+relatedTrades.length+' trades)</h4>';
    h+='<div style="max-height:300px;overflow-y:auto"><table class="wd-drill-table"><thead><tr><th>Time</th><th>Side</th><th>Outcome</th><th>Price</th><th>Size</th><th>Cost</th><th>PnL</th></tr></thead><tbody>';
    for(const t of relatedTrades.slice().reverse()){
      const ts=new Date(t.timestamp).toLocaleString();
      h+='<tr><td style="font-size:10px;white-space:nowrap">'+ts+'</td><td style="font-weight:700;color:'+(t.side==='BUY'?'var(--green)':'var(--red)')+'">'+t.side+'</td><td class="o-'+t.outcome+'">'+t.outcome+'</td><td>$'+fmt(t.price,4)+'</td><td>'+fmt(t.size,1)+'</td><td>$'+fmt(t.cost)+'</td><td class="'+pnlCls(t.realizedPnl)+'">$'+fmt(t.realizedPnl)+'</td></tr>';
    }
    h+='</tbody></table></div>';
    h+='<div style="margin-top:10px;font-size:12px;color:var(--muted)">'+buys.length+' buy(s) totalling $'+fmt(buys.reduce((s,t)=>s+t.cost,0))+' &middot; '+sells.length+' sell(s) totalling $'+fmt(sells.reduce((s,t)=>s+t.cost,0))+'</div>';
  }else{
    h+='<p class="empty" style="margin-top:12px">No trade history found for this market yet.</p>';
  }

  openDrillDown(h);
}

function drillMarket(idx){
  if(!lastWalletDetailData) return;
  const m=lastWalletDetailData.marketBreakdown[idx];
  if(!m) return;
  const netVolume=m.buyVolume-m.sellVolume;
  const spread=m.avgExitPrice>0?((m.avgExitPrice-m.avgEntryPrice)*100).toFixed(2):'N/A';

  /* Related trades */
  const relatedTrades=lastWalletDetailData.tradeHistory.filter(t=>t.marketId===m.marketId);
  const buys=relatedTrades.filter(t=>t.side==='BUY');
  const sells=relatedTrades.filter(t=>t.side==='SELL');

  /* Check for open position */
  const openPos=lastWalletDetailData.wallet.openPositions.find(p=>p.marketId===m.marketId);

  let h='<div class="wd-drill-title">\uD83C\uDFAF Market Breakdown Detail</div>';
  h+='<div class="wd-drill-subtitle">'+m.marketId+'</div>';

  h+='<div class="wd-drill-stats">';
  h+='<div class="wd-drill-stat"><div class="label">Outcome</div><div class="value o-'+m.outcome+'">'+m.outcome+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Total Trades</div><div class="value">'+m.trades+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Buy Volume</div><div class="value">$'+fmt(m.buyVolume)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Sell Volume</div><div class="value">$'+fmt(m.sellVolume)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Net Volume</div><div class="value '+pnlCls(netVolume)+'">$'+fmt(netVolume)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Avg Entry</div><div class="value">$'+fmt(m.avgEntryPrice,4)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Avg Exit</div><div class="value">$'+fmt(m.avgExitPrice,4)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Entry→Exit Spread</div><div class="value">'+spread+'%</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Realized PnL</div><div class="value '+pnlCls(m.realizedPnl)+'">$'+fmt(m.realizedPnl)+'</div></div>';
  h+='</div>';

  if(openPos){
    const opUpnl=openPos.unrealizedPnl||0;
    h+='<div style="background:rgba(79,143,247,.06);border:1px solid rgba(79,143,247,.15);border-radius:8px;padding:14px;margin-bottom:16px">';
    h+='<h4 style="font-size:13px;margin-bottom:8px;color:var(--accent)">\uD83D\uDFE2 Open Position</h4>';
    h+='<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px">';
    h+='<span>Size: <strong>'+fmt(openPos.size,1)+'</strong></span>';
    h+='<span>Avg Price: <strong>$'+fmt(openPos.avgPrice,4)+'</strong></span>';
    h+='<span>Unrealized: <strong class="'+pnlCls(opUpnl)+'">$'+fmt(opUpnl)+'</strong></span>';
    h+='</div></div>';
  }

  if(relatedTrades.length>0){
    h+='<h4 style="font-size:14px;margin-bottom:10px">\uD83D\uDCDD All Trades for This Market ('+relatedTrades.length+')</h4>';
    h+='<div style="max-height:350px;overflow-y:auto"><table class="wd-drill-table"><thead><tr><th>Time</th><th>Side</th><th>Outcome</th><th>Price</th><th>Size</th><th>Cost</th><th>PnL</th><th>Cum. PnL</th><th>Balance</th></tr></thead><tbody>';
    for(const t of relatedTrades.slice().reverse()){
      const ts=new Date(t.timestamp).toLocaleString();
      h+='<tr><td style="font-size:10px;white-space:nowrap">'+ts+'</td><td style="font-weight:700;color:'+(t.side==='BUY'?'var(--green)':'var(--red)')+'">'+t.side+'</td><td class="o-'+t.outcome+'">'+t.outcome+'</td><td>$'+fmt(t.price,4)+'</td><td>'+fmt(t.size,1)+'</td><td>$'+fmt(t.cost)+'</td><td class="'+pnlCls(t.realizedPnl)+'">$'+fmt(t.realizedPnl)+'</td><td class="'+pnlCls(t.cumulativePnl)+'">$'+fmt(t.cumulativePnl)+'</td><td>$'+fmt(t.balanceAfter)+'</td></tr>';
    }
    h+='</tbody></table></div>';
    h+='<div style="margin-top:10px;font-size:12px;color:var(--muted)">'+buys.length+' buy(s) &middot; '+sells.length+' sell(s)</div>';
  }

  openDrillDown(h);
}

function drillTrade(reversedIdx){
  if(!lastWalletDetailData) return;
  const reversed=lastWalletDetailData.tradeHistory.slice().reverse();
  const t=reversed[reversedIdx];
  if(!t) return;
  const ts=new Date(t.timestamp).toLocaleString();
  const timeSince=((Date.now()-new Date(t.timestamp).getTime())/60000);
  const timeAgo=timeSince<60?Math.round(timeSince)+'m ago':timeSince<1440?(timeSince/60).toFixed(1)+'h ago':(timeSince/1440).toFixed(1)+'d ago';

  /* Find matching position */
  const openPos=lastWalletDetailData.wallet.openPositions.find(p=>p.marketId===t.marketId);

  /* Find all trades for same market */
  const marketTrades=lastWalletDetailData.tradeHistory.filter(tr=>tr.marketId===t.marketId);
  const tradeIdx=marketTrades.indexOf(t);
  const mktBreakdown=lastWalletDetailData.marketBreakdown.find(m=>m.marketId===t.marketId);

  let h='<div class="wd-drill-title">\uD83D\uDCDD Trade Detail</div>';
  h+='<div class="wd-drill-subtitle">'+t.marketId+'</div>';

  h+='<div class="wd-drill-stats">';
  h+='<div class="wd-drill-stat"><div class="label">Time</div><div class="value" style="font-size:13px">'+ts+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Age</div><div class="value" style="font-size:14px">'+timeAgo+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Side</div><div class="value" style="color:'+(t.side==='BUY'?'var(--green)':'var(--red)')+'">'+t.side+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Outcome</div><div class="value o-'+t.outcome+'">'+t.outcome+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Price</div><div class="value">$'+fmt(t.price,4)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Size</div><div class="value">'+fmt(t.size,1)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Cost</div><div class="value">$'+fmt(t.cost)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Realized PnL</div><div class="value '+pnlCls(t.realizedPnl)+'">$'+fmt(t.realizedPnl,4)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Cumulative PnL</div><div class="value '+pnlCls(t.cumulativePnl)+'">$'+fmt(t.cumulativePnl)+'</div></div>';
  h+='<div class="wd-drill-stat"><div class="label">Balance After</div><div class="value">$'+fmt(t.balanceAfter)+'</div></div>';
  h+='</div>';

  if(t.strategy){
    h+='<div style="margin-bottom:16px;font-size:12px;color:var(--muted)">Strategy: <strong style="color:var(--accent)">'+t.strategy+'</strong></div>';
  }

  if(openPos){
    const opUpnl=openPos.unrealizedPnl||0;
    h+='<div style="background:rgba(79,143,247,.06);border:1px solid rgba(79,143,247,.15);border-radius:8px;padding:14px;margin-bottom:16px">';
    h+='<h4 style="font-size:13px;margin-bottom:8px;color:var(--accent)">\uD83D\uDFE2 Current Open Position on This Market</h4>';
    h+='<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px">';
    h+='<span>Size: <strong>'+fmt(openPos.size,1)+'</strong></span>';
    h+='<span>Avg Price: <strong>$'+fmt(openPos.avgPrice,4)+'</strong></span>';
    h+='<span>Realized: <strong class="'+pnlCls(openPos.realizedPnl)+'">$'+fmt(openPos.realizedPnl)+'</strong></span>';
    h+='<span>Unrealized: <strong class="'+pnlCls(opUpnl)+'">$'+fmt(opUpnl)+'</strong></span>';
    h+='</div></div>';
  }

  if(mktBreakdown){
    h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px">';
    h+='<h4 style="font-size:13px;margin-bottom:8px">\uD83C\uDFAF Market Summary</h4>';
    h+='<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px">';
    h+='<span>Total Trades: <strong>'+mktBreakdown.trades+'</strong></span>';
    h+='<span>Buy Vol: <strong>$'+fmt(mktBreakdown.buyVolume)+'</strong></span>';
    h+='<span>Sell Vol: <strong>$'+fmt(mktBreakdown.sellVolume)+'</strong></span>';
    h+='<span>Realized PnL: <strong class="'+pnlCls(mktBreakdown.realizedPnl)+'">$'+fmt(mktBreakdown.realizedPnl)+'</strong></span>';
    h+='</div></div>';
  }

  if(marketTrades.length>1){
    h+='<h4 style="font-size:14px;margin-bottom:10px">\uD83D\uDD17 Other Trades on This Market ('+marketTrades.length+' total)</h4>';
    h+='<div style="max-height:250px;overflow-y:auto"><table class="wd-drill-table"><thead><tr><th>Time</th><th>Side</th><th>Price</th><th>Size</th><th>Cost</th><th>PnL</th></tr></thead><tbody>';
    for(const ot of marketTrades.slice().reverse()){
      const isCurrent=ot===t;
      const otTs=new Date(ot.timestamp).toLocaleString();
      h+='<tr style="'+(isCurrent?'background:rgba(79,143,247,.1);':'')+'"><td style="font-size:10px;white-space:nowrap">'+otTs+(isCurrent?' \u25C0':'')+'</td><td style="font-weight:700;color:'+(ot.side==='BUY'?'var(--green)':'var(--red)')+'">'+ot.side+'</td><td>$'+fmt(ot.price,4)+'</td><td>'+fmt(ot.size,1)+'</td><td>$'+fmt(ot.cost)+'</td><td class="'+pnlCls(ot.realizedPnl)+'">$'+fmt(ot.realizedPnl)+'</td></tr>';
    }
    h+='</tbody></table></div>';
  }

  openDrillDown(h);
}

/* ─── Wallets Tab ─── */
function renderWalletTable(wl){
  /* Build paused lookup from SSE data */
  const pausedMap = {};
  if(currentData && currentData.wallets){
    currentData.wallets.forEach(cw => { pausedMap[cw.walletId] = cw.paused || false; });
  }
  $('#wt-body').innerHTML=wl.map(w=>{
    const isPaused = pausedMap[w.walletId] || false;
    const toggleCls = isPaused ? 'paused' : 'running';
    const toggleLabel = isPaused ? '\u25B6 Start' : '\u23F8 Running';
    return '<tr onclick="openWalletDetail(\\''+w.walletId+'\\')" title="Click for detailed analytics">'+
      '<td><strong>'+w.walletId+'</strong> <span style="font-size:10px;color:var(--accent)">\uD83D\uDD0D</span></td>'+
      '<td><span class="badge badge-'+w.mode+'">'+w.mode+'</span></td>'+
      '<td>'+w.assignedStrategy+'</td>'+
      '<td>$'+fmt(w.capitalAllocated,0)+'</td>'+
      '<td>$'+fmt(w.availableBalance,2)+'</td>'+
      '<td class="'+pnlCls(w.realizedPnl)+'">$'+fmt(w.realizedPnl)+'</td>'+
      '<td>'+w.openPositions.length+'</td>'+
      '<td style="display:flex;gap:6px;align-items:center"><button class="toggle-btn '+toggleCls+'" onclick="event.stopPropagation();toggleWallet(\\''+w.walletId+'\\','+isPaused+')" title="'+(isPaused?'Start':'Pause')+' this wallet"><span class="toggle-dot"></span>'+toggleLabel+'</button><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteWallet(\\''+w.walletId+'\\')">Remove</button></td>'+
      '</tr>';
  }).join('');
}

async function deleteWallet(id){
  if(!confirm('Remove wallet "'+id+'"? This cannot be undone.'))return;
  try{
    const r=await fetch('/api/wallets/'+encodeURIComponent(id),{method:'DELETE'});
    const j=await r.json();
    showMsg('cw-msg',j.ok?'ok':'err',j.message||j.error);
    refresh();
  }catch(e){showMsg('cw-msg','err','Network error')}
}

/* ─── Strategies Tab ─── */
let stratDetailOpen=false;

function renderStrategies(strats, wl){
  /* Skip re-render when the detail panel is visible */
  if(stratDetailOpen) return;

  const walletsByStrat={};
  wl.forEach(w=>{
    const s=w.assignedStrategy||w.strategy;
    if(!walletsByStrat[s])walletsByStrat[s]=[];
    walletsByStrat[s].push(w.walletId||w.walletId);
  });

  const grid=$('#strat-grid');
  grid.innerHTML=strats.map(s=>{
    const riskKey=s.riskLevel.replace(/[^a-zA-Z]/g,'-').replace(/--+/g,'-');
    const wallets=walletsByStrat[s.id]||[];
    const params=Object.entries(s.parameters).map(([k,v])=>'<span class="pk">'+k+'</span><span class="pv">'+v+'</span>').join('');
    const steps=s.howItWorks.map(h=>'<li>'+h+'</li>').join('');
    const wTags=wallets.length
      ? wallets.map(wid=>'<span class="sw-tag">'+wid+'</span>').join('')
      : '<span class="sw-none">No wallets assigned</span>';
    return '<div class="strat-card" data-strat-id="'+s.id+'" style="cursor:pointer">'+
      '<div class="strat-hdr"><div><div class="strat-name">'+s.name+'</div><div class="strat-cat">'+s.category+'</div></div>'+
      '<span class="strat-risk risk-'+riskKey+'">'+s.riskLevel+'</span></div>'+
      '<div class="strat-body"><p class="strat-desc">'+s.description+'</p>'+
      '<div class="strat-section-label">How It Works</div><ul class="strat-steps">'+steps+'</ul>'+
      '<div class="strat-section-label">Parameters</div><div class="param-grid">'+params+'</div>'+
      '<div class="strat-ideal">\u2714 Ideal for: '+s.idealFor+'</div>'+
      '<div style="font-size:11px;color:var(--accent);margin-top:8px">\u2139\uFE0F Click card for detailed breakdown</div>'+
      '<div class="strat-wallets"><div class="sw-label">Active Wallets Using This Strategy</div><div class="sw-tags">'+wTags+'</div></div>'+
      '<div class="use-btn"><button class="btn strat-create-btn" data-strat="'+s.id+'">+ Create Wallet With This Strategy</button></div>'+
      '</div></div>';
  }).join('');
}

/* Event delegation: click on strategy card → show detail */
$('#strat-grid').addEventListener('click',function(e){
  /* If the Create button was clicked, handle that instead */
  const createBtn=e.target.closest('.strat-create-btn');
  if(createBtn){
    e.stopPropagation();
    useStrategy(createBtn.getAttribute('data-strat'));
    return;
  }
  const card=e.target.closest('.strat-card[data-strat-id]');
  if(!card)return;
  const stratId=card.getAttribute('data-strat-id');
  if(stratId) showStrategyDetail(stratId);
});

async function showStrategyDetail(stratId){
  try{
    const r=await fetch('/api/strategies/'+encodeURIComponent(stratId));
    if(!r.ok){console.error('Strategy detail fetch failed:',r.status);return}
    const s=await r.json();
    renderStrategyDetail(s);
  }catch(e){console.error('Failed to load strategy detail',e)}
}

function renderStrategyDetail(s){
  /* Hide grid, show detail */
  stratDetailOpen=true;
  $('#strat-grid').style.display='none';
  $('#strat-list-title').style.display='none';
  const panel=$('#strat-detail');
  panel.classList.add('open');

  const riskKey=s.riskLevel.replace(/[^a-zA-Z]/g,'-').replace(/--+/g,'-');
  $('#sd-title').textContent=s.name;
  $('#sd-risk').className='strat-risk risk-'+riskKey;
  $('#sd-risk').textContent=s.riskLevel;
  $('#sd-category').textContent=s.category;
  $('#sd-version').textContent=s.version?'v'+s.version:'';
  $('#sd-long-desc').textContent=s.longDescription||s.description;

  /* Tags */
  $('#sd-tags').innerHTML=(s.tags||[]).map(t=>'<span class="strat-detail-tag">'+t+'</span>').join('');

  /* How it works */
  $('#sd-how').innerHTML=(s.howItWorks||[]).map(h=>'<li>'+h+'</li>').join('');

  /* Ideal for */
  $('#sd-ideal').textContent='\u2714 Ideal for: '+s.idealFor;

  /* Create button */
  $('#sd-create-btn').onclick=function(e){e.stopPropagation();useStrategy(s.id)};

  /* Live wallets */
  const lwSection=$('#sd-live-wallets-section');
  if(s.liveWallets&&s.liveWallets.length>0){
    lwSection.innerHTML='<div class="strat-detail-section"><h4><span class="sd-icon">\uD83D\uDCB0</span> Active Wallets ('+s.liveWallets.length+')</h4>'+
      s.liveWallets.map(w=>{
        return '<div class="live-wallet-card">'+
          '<div><span class="lw-id">'+w.walletId+'</span> <span class="badge badge-'+w.mode+'">'+w.mode+'</span></div>'+
          '<div class="lw-stats">'+
            '<span>Capital: $'+fmt(w.capital,0)+'</span>'+
            '<span>Balance: $'+fmt(w.balance)+'</span>'+
            '<span class="'+pnlCls(w.pnl)+'">PnL: $'+fmt(w.pnl)+'</span>'+
            '<span>Positions: '+w.openPositions+'</span>'+
          '</div></div>';
      }).join('')+'</div>';
  }else{
    lwSection.innerHTML='<div class="strat-detail-section"><h4><span class="sd-icon">\uD83D\uDCB0</span> Active Wallets</h4><div class="empty">No wallets using this strategy yet</div></div>';
  }

  /* Whale Address Management (copy_trade only) */
  const whaleMgmt=$('#sd-whale-mgmt');
  if(s.id==='copy_trade'){
    whaleMgmt.style.display='block';
    loadWhaleAddresses();
  }else{
    whaleMgmt.style.display='none';
  }

  /* Basic Parameters (show for all strategies, especially useful for ones without advanced detail) */
  const paramsSection=$('#sd-params-section');
  const paramsEl=$('#sd-params');
  const hasAdvanced=s.filters||s.entryLogic||s.exitRules||s.configSchema;
  if(s.parameters&&Object.keys(s.parameters).length>0&&!hasAdvanced){
    paramsSection.style.display='';
    paramsEl.innerHTML=Object.entries(s.parameters).map(function(kv){return '<span class="pk">'+kv[0]+'</span><span class="pv">'+kv[1]+'</span>'}).join('');
  }else{
    paramsSection.style.display='none';
  }

  /* Filter Pipeline */
  const filtersEl=$('#sd-filters');
  if(s.filters&&s.filters.length>0){
    filtersEl.innerHTML=s.filters.map((f,i)=>{
      const keys=f.configKeys.map(k=>'<span class="fi-key">'+k+'</span>').join('');
      return '<div class="filter-item">'+
        '<div class="fi-label">'+(i+1)+'. '+f.label+'</div>'+
        '<div class="fi-desc">'+f.description+'</div>'+
        '<div class="fi-keys">'+keys+'</div></div>';
    }).join('');
    filtersEl.closest('.strat-detail-section').style.display='';
  }else{
    filtersEl.closest('.strat-detail-section').style.display='none';
  }

  /* Entry Logic */
  const entryEl=$('#sd-entry');
  if(s.entryLogic&&s.entryLogic.length>0){
    entryEl.innerHTML=s.entryLogic.map(e=>'<li>'+e+'</li>').join('');
    entryEl.closest('.strat-detail-section').style.display='';
  }else{
    entryEl.closest('.strat-detail-section').style.display='none';
  }

  /* Position Sizing */
  const sizingEl=$('#sd-sizing');
  if(s.positionSizing&&s.positionSizing.length>0){
    sizingEl.innerHTML=s.positionSizing.map(p=>'<li>'+p+'</li>').join('');
    sizingEl.closest('.strat-detail-section').style.display='';
  }else{
    sizingEl.closest('.strat-detail-section').style.display='none';
  }

  /* Exit Rules */
  const exitsEl=$('#sd-exits');
  if(s.exitRules&&s.exitRules.length>0){
    exitsEl.innerHTML=s.exitRules.map(r=>{
      return '<div class="exit-rule"><div class="er-name">'+r.name+'</div><div class="er-desc">'+r.description+'</div></div>';
    }).join('');
    exitsEl.closest('.strat-detail-section').style.display='';
  }else{
    exitsEl.closest('.strat-detail-section').style.display='none';
  }

  /* Risk Controls */
  const risksEl=$('#sd-risks');
  if(s.riskControls&&s.riskControls.length>0){
    risksEl.innerHTML=s.riskControls.map(r=>{
      return '<div class="risk-item"><div class="ri-badge"></div><div class="ri-name">'+r.name+'</div><div class="ri-desc">'+r.description+(r.configKey?' <code style="font-size:10px;color:var(--accent)">'+r.configKey+'</code>':'')+'</div></div>';
    }).join('');
    risksEl.closest('.strat-detail-section').style.display='';
  }else{
    risksEl.closest('.strat-detail-section').style.display='none';
  }

  /* Config Table */
  const configSection=$('#sd-config-section');
  const configBody=$('#sd-config-body');
  if(s.configSchema&&s.configSchema.length>0){
    configSection.style.display='';
    let lastGroup='';
    configBody.innerHTML=s.configSchema.map(c=>{
      let groupRow='';
      if(c.group!==lastGroup){lastGroup=c.group;groupRow='<tr class="config-group-hdr"><td colspan="5">'+c.group+'</td></tr>'}
      return groupRow+'<tr>'+
        '<td class="cfg-key">'+c.key+'</td>'+
        '<td>'+c.label+'</td>'+
        '<td class="cfg-val">'+c.default+'</td>'+
        '<td>'+(c.unit||'-')+'</td>'+
        '<td style="color:var(--muted)">'+c.description+'</td></tr>';
    }).join('');
  }else{
    configSection.style.display='none';
  }
}

$('#strat-back').addEventListener('click',()=>{
  stratDetailOpen=false;
  $('#strat-detail').classList.remove('open');
  $('#strat-grid').style.display='';
  $('#strat-list-title').style.display='';
});

/* ─── Whale Address Management ─── */
async function loadWhaleAddresses(){
  try{
    const r=await fetch('/api/copy-trade/whales');
    if(!r.ok)return;
    const data=await r.json();
    renderWhaleList(data);
  }catch(e){console.error('Failed to load whale addresses',e)}
}

function renderWhaleList(data){
  const list=$('#whale-list');
  const countEl=$('#whale-count');
  const addrs=data.addresses||[];
  const perfArr=data.whalePerformance||[];
  countEl.textContent='('+addrs.length+' tracked)';
  if(addrs.length===0){
    list.innerHTML='<div class="whale-empty">\uD83D\uDC33 No whale addresses configured yet. Add one above to start copy trading.</div>';
    return;
  }
  list.innerHTML=perfArr.map(function(w){
    const winPct=w.tradesCopied>0?((w.winRate*100).toFixed(0)+'%'):'—';
    const pnlCls=w.totalPnlBps>0?'positive':w.totalPnlBps<0?'negative':'';
    const statusCls=w.paused?'paused':'active';
    const statusText=w.paused?'Paused':'Active';
    const shortAddr=w.address.length>16?(w.address.slice(0,8)+'\u2026'+w.address.slice(-6)):w.address;
    return '<div class="whale-item" data-addr="'+w.address+'">'+
      '<div class="whale-item-left">'+
        '<span class="whale-badge '+statusCls+'">'+statusText+'</span>'+
        '<span class="whale-addr" title="'+w.address+'">'+shortAddr+'</span>'+
      '</div>'+
      '<div class="whale-stats">'+
        '<span class="whale-stat"><span class="ws-val">'+w.tradesCopied+'</span> trades</span>'+
        '<span class="whale-stat"><span class="ws-val">'+winPct+'</span> win</span>'+
        '<span class="whale-stat '+pnlCls+'"><span class="ws-val">'+(w.totalPnlBps>0?'+':'')+w.totalPnlBps+'</span> bps</span>'+
        '<span class="whale-stat"><span class="ws-val">'+w.consecutiveLosses+'</span> streak</span>'+
      '</div>'+
      '<button class="whale-remove-btn" onclick="removeWhale(\\\''+w.address+'\\\')">\u2716 Remove</button>'+
    '</div>';
  }).join('');
}

function showWhaleMsg(type,msg){
  const el=$('#whale-msg');
  el.className='whale-msg '+type;
  el.textContent=msg;
  setTimeout(()=>{el.style.display='none';el.className='whale-msg'},4000);
}

$('#whale-add-btn').addEventListener('click',async()=>{
  const input=$('#whale-addr-input');
  const address=input.value.trim();
  if(!address){showWhaleMsg('err','Please enter a wallet address');return}
  const btn=$('#whale-add-btn');
  btn.disabled=true;
  try{
    const r=await fetch('/api/copy-trade/whales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address})});
    const j=await r.json();
    if(j.ok){
      showWhaleMsg('ok','\uD83D\uDC33 '+j.message);
      input.value='';
      loadWhaleAddresses();
    }else{
      showWhaleMsg('err',j.error||'Failed to add address');
    }
  }catch(e){showWhaleMsg('err','Network error')}
  btn.disabled=false;
});

$('#whale-addr-input').addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();$('#whale-add-btn').click()}
});

async function removeWhale(address){
  if(!confirm('Remove whale address '+address.slice(0,12)+'\u2026 from copy trading?'))return;
  try{
    const r=await fetch('/api/copy-trade/whales/'+encodeURIComponent(address),{method:'DELETE'});
    const j=await r.json();
    if(j.ok){
      showWhaleMsg('ok','\u2716 '+j.message);
      loadWhaleAddresses();
    }else{
      showWhaleMsg('err',j.error||'Failed to remove');
    }
  }catch(e){showWhaleMsg('err','Network error')}
}

function useStrategy(stratId){
  /* Switch to wallets tab and pre-fill the strategy */
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelector('[data-tab="wallets"]').classList.add('active');
  document.getElementById('pane-wallets').classList.add('active');
  document.getElementById('cw-strategy').value=stratId;
  document.getElementById('cw-id').focus();
}

/* ─── Create wallet form ─── */
async function populateStrategyDropdown(){
  try{
    const r=await fetch('/api/strategies');
    strategies=await r.json();
    const sel=$('#cw-strategy');
    sel.innerHTML=strategies.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  }catch(e){console.error(e)}
}

$('#cw-submit').addEventListener('click',async()=>{
  const body={
    walletId:$('#cw-id').value.trim(),
    mode:$('#cw-mode').value,
    strategy:$('#cw-strategy').value,
    capital:Number($('#cw-capital').value),
  };
  const mp=$('#cw-maxpos').value;if(mp)body.maxPositionSize=Number(mp);
  const me=$('#cw-maxexp').value;if(me)body.maxExposurePerMarket=Number(me);
  const ml=$('#cw-maxloss').value;if(ml)body.maxDailyLoss=Number(ml);
  const mt=$('#cw-maxtrades').value;if(mt)body.maxOpenTrades=Number(mt);

  try{
    const r=await fetch('/api/wallets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json();
    showMsg('cw-msg',j.ok?'ok':'err',j.message||j.error);
    if(j.ok){$('#cw-id').value='';$('#cw-capital').value='500';refresh()}
  }catch(e){showMsg('cw-msg','err','Network error')}
});

function showMsg(id,type,msg){
  const el=document.getElementById(id);
  el.className='form-msg '+type;
  el.textContent=msg;
  el.style.display='block';
  setTimeout(()=>{el.style.display='none'},5000);
}

/* ─── Markets Tab ─── */
async function loadMarkets(){
  try{
    const res=await fetch('/api/markets');
    const markets=await res.json();
    if(Array.isArray(markets)){
      for(const m of markets){
        if(m&&m.marketId&&m.slug){
          rememberMarketSlug(m.marketId,m.slug);
        }
      }
      marketSlugCacheLoadedAt=Date.now();
    }
    const tbody=$('#mkts-body');
    if(!markets.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--muted)">No markets found</td></tr>';return;}
    tbody.innerHTML=markets.map(m=>{
      const yes=(m.outcomePrices[0]*100).toFixed(1);
      const no=(m.outcomePrices[1]*100).toFixed(1);
      const spread=(m.spread*100).toFixed(2);
      const vol=m.volume24h>=1000?(m.volume24h/1000).toFixed(1)+'k':m.volume24h.toFixed(0);
      const liq=m.liquidity>=1000?(m.liquidity/1000).toFixed(1)+'k':m.liquidity.toFixed(0);
      const q=m.question.length>80?m.question.slice(0,77)+'...':m.question;
      const yesColor=m.outcomePrices[0]>0.6?'#4ade80':m.outcomePrices[0]<0.4?'#f87171':'#facc15';
      const noColor=m.outcomePrices[1]>0.6?'#4ade80':m.outcomePrices[1]<0.4?'#f87171':'#facc15';
      return '<tr>'+
        '<td style="max-width:320px;white-space:normal;line-height:1.3"><strong>'+q+'</strong><br><span style="color:var(--muted);font-size:11px">ID: '+m.marketId+'</span><div class="ext-link-row">'+renderPolyLinks(m.marketId,m.slug)+'</div></td>'+
        '<td style="color:'+yesColor+';font-weight:600">'+yes+'%</td>'+
        '<td style="color:'+noColor+';font-weight:600">'+no+'%</td>'+
        '<td>'+m.bid.toFixed(3)+'</td>'+
        '<td>'+m.ask.toFixed(3)+'</td>'+
        '<td>'+spread+'%</td>'+
        '<td>$'+vol+'</td>'+
        '<td>$'+liq+'</td>'+
        '</tr>';
    }).join('');
  }catch(e){console.error('Failed to load markets',e);}
}
$('#mkts-refresh').addEventListener('click',loadMarkets);

/* ─── Analytics Tab ─── */
let anAutoRefresh=false;
let anInterval=null;
let lastAnWallet='';

function populateAnalyticsDropdown(){
  const sel=$('#an-wallet');
  const cur=sel.value;
  const opts='<option value="">-- choose a wallet --</option>'+walletList.map(w=>'<option value="'+w.walletId+'"'+(w.walletId===cur?' selected':'')+'>'+w.walletId+' ('+w.mode+' / '+w.assignedStrategy+')</option>').join('');
  sel.innerHTML=opts;
}

$('#an-load').addEventListener('click',()=>{
  const wid=$('#an-wallet').value;
  if(!wid)return;
  lastAnWallet=wid;
  loadAnalytics(wid);
});

$('#an-refresh').addEventListener('click',()=>{
  anAutoRefresh=!anAutoRefresh;
  $('#an-refresh').textContent='Auto-refresh: '+(anAutoRefresh?'ON':'OFF');
  $('#an-refresh').style.borderColor=anAutoRefresh?'var(--green)':'var(--border)';
  $('#an-refresh').style.color=anAutoRefresh?'var(--green)':'var(--text)';
  if(anAutoRefresh&&lastAnWallet){
    anInterval=setInterval(()=>loadAnalytics(lastAnWallet),3000);
  }else{
    if(anInterval){clearInterval(anInterval);anInterval=null}
  }
});

async function loadAnalytics(wid){
  try{
    const r=await fetch('/api/trades/'+encodeURIComponent(wid));
    if(!r.ok){$('#an-empty').style.display='block';$('#an-summary').style.display='none';return}
    const d=await r.json();
    renderAnalytics(d);
  }catch(e){console.error(e)}
}

function renderAnalytics(d){
  $('#an-empty').style.display='none';
  $('#an-summary').style.display='block';
  const s=d.summary;

  /* stats row */
  $('#an-stats').innerHTML=
    '<div class="an-stat-card"><div class="label">Total Trades</div><div class="value">'+s.totalTrades+'</div><div class="sub">'+s.buys+' buys / '+s.sells+' sells</div></div>'+
    '<div class="an-stat-card"><div class="label">Total PnL</div><div class="value '+pnlCls(s.totalPnl)+'">$'+fmt(s.totalPnl)+'</div><div class="sub">Best: $'+fmt(s.bestTrade)+' / Worst: $'+fmt(s.worstTrade)+'</div></div>'+
    '<div class="an-stat-card"><div class="label">Win Rate</div><div class="value">'+(s.winRate*100).toFixed(1)+'%</div><div class="sub">'+s.winningTrades+'W / '+s.losingTrades+'L</div></div>'+
    '<div class="an-stat-card"><div class="label">Volume Traded</div><div class="value">$'+fmt(s.totalVolume,0)+'</div><div class="sub">Avg size: $'+fmt(s.avgTradeSize)+'</div></div>'+
    '<div class="an-stat-card"><div class="label">Capital</div><div class="value">$'+fmt(s.capitalAllocated,0)+'</div><div class="sub">Available: $'+fmt(s.availableBalance)+'</div></div>';

  /* PnL chart */
  renderMiniChart('an-pnl-chart',d.trades.map(t=>t.cumulativePnl),'pnl');

  /* Balance chart */
  renderMiniChart('an-bal-chart',d.trades.map(t=>t.balanceAfter),'balance');

  /* trade table */
  const rows=d.trades.map((t,i)=>{
    const time=new Date(t.timestamp).toLocaleTimeString();
    return '<tr>'+
      '<td>'+(i+1)+'</td>'+
      '<td>'+time+'</td>'+
      '<td>'+t.marketId+'</td>'+
      '<td><span style="color:'+(t.side==='BUY'?'var(--green)':'var(--red)')+'">'+t.side+'</span></td>'+
      '<td class="o-'+t.outcome+'">'+t.outcome+'</td>'+
      '<td>$'+fmt(t.price,4)+'</td>'+
      '<td>'+fmt(t.size,1)+'</td>'+
      '<td>$'+fmt(t.cost,2)+'</td>'+
      '<td class="'+pnlCls(t.realizedPnl)+'">$'+fmt(t.realizedPnl,4)+'</td>'+
      '<td class="'+pnlCls(t.cumulativePnl)+'">$'+fmt(t.cumulativePnl,4)+'</td>'+
      '<td>$'+fmt(t.balanceAfter,2)+'</td>'+
      '</tr>';
  }).reverse().join('');
  $('#an-tbody').innerHTML=rows||'<tr><td colspan="11" class="empty">No trades yet</td></tr>';
}

function renderMiniChart(containerId,values,type){
  const el=document.getElementById(containerId);
  if(!values.length){el.innerHTML='<div class="empty" style="padding:20px;text-align:center">No data</div>';return}
  const w=el.clientWidth||400;
  const h=el.clientHeight||180;
  const pad=4;
  const mn=Math.min(...values);
  const mx=Math.max(...values);
  const range=mx-mn||1;
  const pts=values.map((v,i)=>{
    const x=pad+(i/(Math.max(1,values.length-1)))*(w-pad*2);
    const y=h-pad-((v-mn)/range)*(h-pad*2);
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  const zeroY=h-pad-((0-mn)/range)*(h-pad*2);
  const color=type==='pnl'?(values[values.length-1]>=0?'var(--green)':'var(--red)'):'var(--accent)';
  const fillPts=pad.toFixed(1)+','+(h-pad)+' '+pts+' '+(w-pad).toFixed(1)+','+(h-pad);
  el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" style="width:100%;height:100%">'+
    '<defs><linearGradient id="g-'+containerId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity="0.3"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0.02"/></linearGradient></defs>'+
    (type==='pnl'&&mn<0&&mx>0?'<line x1="'+pad+'" y1="'+zeroY.toFixed(1)+'" x2="'+(w-pad)+'" y2="'+zeroY.toFixed(1)+'" stroke="var(--muted)" stroke-width="0.5" stroke-dasharray="4,3"/>':'')+
    '<polygon points="'+fillPts+'" fill="url(#g-'+containerId+')"/>'+
    '<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+
    '</svg>';
}

/* ─── WHALE TAB ─── */
let whaleDetailOpen=false;

/* Sub-navigation */
document.querySelectorAll('.wh-sub').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.wh-sub').forEach(b=>{b.classList.remove('active');b.style.background='var(--surface2)';b.style.color='var(--text)'});
    document.querySelectorAll('.wh-view').forEach(v=>v.style.display='none');
    btn.classList.add('active');btn.style.background='';btn.style.color='';
    const sub=btn.dataset.sub;
    const el=document.getElementById('wh-view-'+sub);
    if(el)el.style.display='block';
    document.getElementById('wh-detail').style.display='none';
    whaleDetailOpen=false;
    if(sub==='list')loadWhaleList();
    if(sub==='candidates')loadCandidates();
    if(sub==='alerts')loadAlerts();
    if(sub==='signals')loadSignals();
    if(sub==='watchlists')loadWatchlists();
    if(sub==='scanner')loadScanner();
    if(sub==='clusters')loadClusterSignals();
    if(sub==='network')loadNetworkGraph();
    if(sub==='copysim')loadCopySim();
    if(sub==='regime')loadRegime();
    if(sub==='apipool')loadApiPool();
  });
});

async function loadWhales(){
  try{
    const r=await fetch('/api/whales/summary');
    if(!r.ok)return;
    const s=await r.json();
    document.getElementById('wh-total').textContent=s.trackedWhales;
    document.getElementById('wh-alerts').textContent=s.unreadAlerts;
    document.getElementById('wh-candidates').textContent=s.candidateCount;
    document.getElementById('wh-status').innerHTML=s.serviceRunning?'<span style="color:var(--green)">Running</span>':'<span style="color:var(--red)">Stopped</span>';
    const ss=s.scannerStatus||'off';
    const ssColor=ss==='scanning'?'var(--blue)':ss==='idle'?'var(--green)':'var(--muted)';
    document.getElementById('wh-scanner-status').innerHTML='<span style="color:'+ssColor+'">'+ss.charAt(0).toUpperCase()+ss.slice(1)+'</span>';
    loadWhaleList();
    /* Also refresh scanner state for top-level controls */
    loadScanner();
  }catch(e){console.error('Whale load error',e)}
}

async function loadWhaleList(){
  try{
    const r=await fetch('/api/whales?limit=50');
    if(!r.ok)return;
    const d=await r.json();
    const tbody=document.getElementById('wh-list-body');
    if(!d.whales||d.whales.length===0){tbody.innerHTML='<tr><td colspan="10" class="empty">No whales tracked yet. Add one to get started.</td></tr>';return}
    tbody.innerHTML=d.whales.map(w=>{
      const addr=w.address.slice(0,6)+'…'+w.address.slice(-4);
      const star=w.starred?'⭐':'☆';
      const scoreCls=w.whaleScore>=60?'pnl-pos':w.whaleScore>=30?'pnl-zero':'pnl-neg';
      const intCls=w.dataIntegrity==='HEALTHY'?'pnl-pos':w.dataIntegrity==='DEGRADED'?'pnl-neg':'';
      return '<tr style="cursor:pointer" onclick="showWhaleDetail('+w.id+')">'+
        '<td>'+star+'</td>'+
        '<td><code style="font-size:11px">'+addr+'</code></td>'+
        '<td>'+(w.displayName||'-')+'</td>'+
        '<td><span style="font-size:11px;text-transform:uppercase;color:var(--muted)">'+w.style+'</span></td>'+
        '<td class="'+scoreCls+'">'+(w.scoreProvisional?'~':'')+fmt(w.whaleScore,0)+'</td>'+
        '<td>$'+fmt(w.totalVolume30d,0)+'</td>'+
        '<td class="'+pnlCls(w.realizedPnl30d)+'">$'+fmt(w.realizedPnl30d)+'</td>'+
        '<td>'+(w.winRate*100).toFixed(0)+'%</td>'+
        '<td class="'+intCls+'">'+w.dataIntegrity+'</td>'+
        '<td><button onclick="event.stopPropagation();toggleStar('+w.id+','+!w.starred+')" style="background:none;border:none;cursor:pointer;font-size:14px">'+(w.starred?'★':'☆')+'</button></td>'+
        '</tr>';
    }).join('');
  }catch(e){console.error(e)}
}

async function showWhaleDetail(id){
  try{
    const r=await fetch('/api/whales/'+id+'/detail');
    if(!r.ok)return;
    const d=await r.json();
    whaleDetailOpen=true;
    document.querySelectorAll('.wh-view').forEach(v=>v.style.display='none');
    const det=document.getElementById('wh-detail');
    det.style.display='block';
    document.getElementById('wh-det-title').textContent=(d.whale.displayName||d.whale.address.slice(0,10)+'…')+' Detail';
    /* Stats */
    const pos=d.openPositions||[];
    document.getElementById('wh-det-stats').innerHTML=
      '<div class="s-card"><div class="label">Score</div><div class="value '+(d.scoreBreakdown.overall>=50?'pnl-pos':'pnl-zero')+'">'+fmt(d.scoreBreakdown.overall,0)+(d.scoreBreakdown.provisional?' <small>(provisional)</small>':'')+'</div></div>'+
      '<div class="s-card"><div class="label">Open Positions</div><div class="value">'+pos.length+'</div></div>'+
      '<div class="s-card"><div class="label">Recent Trades</div><div class="value">'+d.recentTrades.length+'</div></div>'+
      '<div class="s-card"><div class="label">Confidence</div><div class="value">'+(d.scoreBreakdown.confidence*100).toFixed(0)+'%</div></div>';
    /* Score breakdown */
    const c=d.scoreBreakdown.components;
    document.getElementById('wh-det-score').innerHTML=Object.entries(c).map(([k,v])=>{
      const pctVal=Math.min(100,Math.max(0,v));
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+
        '<span style="width:140px;font-size:11px;color:var(--muted)">'+k+'</span>'+
        '<div style="flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden"><div style="width:'+pctVal+'%;height:100%;background:var(--accent);border-radius:3px"></div></div>'+
        '<span style="width:30px;text-align:right;font-size:11px;font-weight:600">'+Math.round(v)+'</span>'+
        '</div>';
    }).join('');
    /* Equity curve */
    if(d.equityCurve&&d.equityCurve.length>1){
      renderMiniChart('wh-det-equity',d.equityCurve.map(p=>p.pnl),'pnl');
    }else{
      document.getElementById('wh-det-equity').innerHTML='<div class="empty" style="padding:20px;text-align:center">Not enough data</div>';
    }
    /* Trades */
    document.getElementById('wh-det-trades').innerHTML=(d.recentTrades||[]).slice(0,30).map(t=>{
      const time=new Date(t.ts).toLocaleString();
      return '<tr>'+
        '<td style="font-size:11px">'+time+'</td>'+
        '<td style="font-size:11px">'+t.marketId.slice(0,12)+'…</td>'+
        '<td style="color:'+(t.side==='BUY'?'var(--green)':'var(--red)')+'">'+t.side+'</td>'+
        '<td>$'+fmt(t.price,3)+'</td>'+
        '<td>'+fmt(t.size,1)+'</td>'+
        '<td>$'+fmt(t.notionalUsd)+'</td>'+
        '<td>'+(t.slippageBps!=null?fmt(t.slippageBps,1)+' bps':'-')+'</td>'+
        '</tr>';
    }).join('')||'<tr><td colspan="7" class="empty">No trades yet</td></tr>';
  }catch(e){console.error(e)}
}

document.getElementById('wh-det-close').addEventListener('click',()=>{
  document.getElementById('wh-detail').style.display='none';
  document.getElementById('wh-view-list').style.display='block';
  whaleDetailOpen=false;
});

async function toggleStar(id,starred){
  await fetch('/api/whales/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({starred})});
  loadWhaleList();
}

async function loadCandidates(){
  try{
    const r=await fetch('/api/whales/candidates?limit=50');
    if(!r.ok)return;
    const list=await r.json();
    const tbody=document.getElementById('wh-cand-body');
    if(!list||list.length===0){tbody.innerHTML='<tr><td colspan="8" class="empty">No candidates discovered yet</td></tr>';return}
    tbody.innerHTML=list.map(c=>{
      const addr=c.address.slice(0,6)+'…'+c.address.slice(-4);
      return '<tr>'+
        '<td><code style="font-size:11px">'+addr+'</code></td>'+
        '<td>$'+fmt(c.volumeUsd24h,0)+'</td>'+
        '<td>'+c.trades24h+'</td>'+
        '<td>$'+fmt(c.maxSingleTradeUsd,0)+'</td>'+
        '<td>'+c.markets7d+'</td>'+
        '<td>'+fmt(c.rankScore,0)+'</td>'+
        '<td style="font-size:11px">'+(c.suggestedTags||[]).join(', ')+'</td>'+
        '<td><button onclick="approveCandidate(\\''+c.address+'\\')" style="background:var(--green);color:#000;border:none;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer">Track</button> '+
        '<button onclick="muteCandidate(\\''+c.address+'\\')" style="background:var(--surface2);color:var(--muted);border:1px solid var(--border);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer">Mute</button></td>'+
        '</tr>';
    }).join('');
  }catch(e){console.error(e)}
}

async function approveCandidate(addr){
  await fetch('/api/whales/candidates/'+addr+'/approve',{method:'POST'});
  loadCandidates();loadWhales();
}
async function muteCandidate(addr){
  await fetch('/api/whales/candidates/'+addr+'/mute',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  loadCandidates();
}

async function loadAlerts(){
  try{
    const r=await fetch('/api/whales/alerts?limit=50');
    if(!r.ok)return;
    const list=await r.json();
    const tbody=document.getElementById('wh-alert-body');
    if(!list||list.length===0){tbody.innerHTML='<tr><td colspan="5" class="empty">No alerts yet</td></tr>';return}
    tbody.innerHTML=list.map(a=>{
      const time=new Date(a.createdAt).toLocaleString();
      const status=a.readAt?'<span style="color:var(--muted)">Read</span>':'<span style="color:var(--yellow)">Unread</span>';
      const details=Object.entries(a.payload||{}).map(([k,v])=>k+': '+JSON.stringify(v)).join(', ');
      return '<tr style="opacity:'+(a.readAt?'0.6':'1')+'">'+
        '<td style="font-size:11px">'+time+'</td>'+
        '<td><code style="font-size:11px">'+a.type+'</code></td>'+
        '<td>'+(a.whaleId||'-')+'</td>'+
        '<td style="font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+details+'</td>'+
        '<td>'+status+'</td></tr>';
    }).join('');
  }catch(e){console.error(e)}
}

document.getElementById('wh-mark-all-read').addEventListener('click',async()=>{
  await fetch('/api/whales/alerts/read-all',{method:'POST'});
  loadAlerts();loadWhales();
});

async function loadSignals(){
  try{
    const r=await fetch('/api/whales/signals?limit=50');
    if(!r.ok)return;
    const list=await r.json();
    const tbody=document.getElementById('wh-signal-body');
    if(!list||list.length===0){tbody.innerHTML='<tr><td colspan="3" class="empty">No signals yet</td></tr>';return}
    tbody.innerHTML=list.map(s=>{
      const time=new Date(s.createdAt).toLocaleString();
      const details=Object.entries(s.payload||{}).map(([k,v])=>k+': '+JSON.stringify(v)).join(', ');
      return '<tr><td style="font-size:11px">'+time+'</td><td><code style="font-size:11px">'+s.type+'</code></td><td style="font-size:11px">'+details+'</td></tr>';
    }).join('');
  }catch(e){console.error(e)}
}

async function loadWatchlists(){
  try{
    const r=await fetch('/api/whales/watchlists');
    if(!r.ok)return;
    const lists=await r.json();
    const container=document.getElementById('wh-wl-list');
    if(!lists||lists.length===0){container.innerHTML='<div class="empty">No watchlists yet. Create one above.</div>';return}
    container.innerHTML=lists.map(wl=>'<div class="form-box" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center"><strong>'+wl.name+'</strong><button onclick="deleteWatchlist('+wl.id+')" style="background:var(--red);color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer">Delete</button></div></div>').join('');
  }catch(e){console.error(e)}
}

document.getElementById('wh-wl-create').addEventListener('click',async()=>{
  const name=document.getElementById('wh-wl-name').value.trim();
  if(!name)return;
  await fetch('/api/whales/watchlists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
  document.getElementById('wh-wl-name').value='';
  loadWatchlists();
});
async function deleteWatchlist(id){
  await fetch('/api/whales/watchlists/'+id,{method:'DELETE'});
  loadWatchlists();
}

/* Add whale form */
document.getElementById('wh-add-btn').addEventListener('click',async()=>{
  const addr=document.getElementById('wh-add-addr').value.trim();
  if(!addr){document.getElementById('wh-add-msg').textContent='Address required';return}
  const name=document.getElementById('wh-add-name').value.trim()||undefined;
  const tags=(document.getElementById('wh-add-tags').value||'').split(',').map(s=>s.trim()).filter(Boolean);
  const notes=document.getElementById('wh-add-notes').value.trim()||undefined;
  try{
    const r=await fetch('/api/whales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:addr,displayName:name,tags:tags.length?tags:undefined,notes})});
    if(r.ok){
      document.getElementById('wh-add-msg').style.color='var(--green)';
      document.getElementById('wh-add-msg').textContent='✓ Whale added & backfilling';
      document.getElementById('wh-add-addr').value='';document.getElementById('wh-add-name').value='';
      document.getElementById('wh-add-tags').value='';document.getElementById('wh-add-notes').value='';
      loadWhales();
    }else{
      const d=await r.json();
      document.getElementById('wh-add-msg').style.color='var(--red)';
      document.getElementById('wh-add-msg').textContent=d.error||'Error';
    }
  }catch(e){document.getElementById('wh-add-msg').textContent='Network error'}
});

/* ─── Scanner ─── */
let scannerPollInterval=null;
async function loadScanner(){
  try{
    const r=await fetch('/api/whales/scanner/state');
    if(!r.ok)return;
    const st=await r.json();
    const stColor=st.status==='scanning'?'var(--blue)':st.status==='idle'?'var(--green)':st.status==='error'?'var(--red)':'var(--muted)';
    const scanDetail=st.status==='scanning'?(st.currentMarket?st.scanProgress+'% · '+st.marketsScanned+'/'+st.marketsInCurrentBatch:st.enabled?'ACTIVE':''):'';
    const stLabel=st.status.toUpperCase()+(scanDetail?' · '+scanDetail:'');
    document.getElementById('wh-scan-st').innerHTML='<span style="color:'+stColor+'">'+stLabel+'</span>';
    document.getElementById('wh-scan-mkts').textContent=String(st.marketsScanned??0);
    document.getElementById('wh-scan-disc').textContent=String(st.totalMarketsDiscovered??0);
    document.getElementById('wh-scan-prof').textContent=String(st.profilesFound??0);
    document.getElementById('wh-scan-qual').textContent=String(st.qualifiedCount??0);
    document.getElementById('wh-scan-batch').textContent=String(st.batchNumber??0);
    document.getElementById('wh-scan-last').textContent=st.lastScanAt?new Date(st.lastScanAt).toLocaleString():(st.status==='scanning'?'In progress…':'Never');
    document.getElementById('wh-scan-dur').textContent=st.scanDurationMs?(st.scanDurationMs/1000).toFixed(1)+'s':(st.status==='scanning'?'Running…':'-');
    const totalSec=st.totalScanTimeMs?Math.round(st.totalScanTimeMs/1000):0;
    document.getElementById('wh-scan-total-time').textContent=totalSec>=60?Math.round(totalSec/60)+'m':totalSec>0?totalSec+'s':'-';
    /* Performance metrics */
    if(st.perf){
      document.getElementById('wh-scan-mps').textContent=st.perf.marketsPerSecond.toFixed(1);
      document.getElementById('wh-scan-tps').textContent=st.perf.tradesPerSecond.toFixed(0);
      document.getElementById('wh-scan-lat').textContent=st.perf.avgFetchLatencyMs+'ms';
      document.getElementById('wh-scan-workers').textContent=String(st.perf.concurrentWorkers);
    }
    const errEl=document.getElementById('wh-scan-err');
    if(st.lastError){errEl.style.display='block';errEl.textContent='Error: '+st.lastError}else{errEl.style.display='none'}
    if(st.currentMarket){errEl.style.display='block';errEl.style.color='var(--muted)';errEl.textContent='Scanning: '+st.currentMarket}
    document.getElementById('wh-top-scanner-st').innerHTML='<span style="color:'+stColor+'">'+stLabel+'</span>'+(st.lastScanAt?' · Last: '+new Date(st.lastScanAt).toLocaleTimeString():'');
    loadScannerProfiles();
    /* Auto-poll while scanning so stats update live */
    if(st.status==='scanning'&&!scannerPollInterval){
      scannerPollInterval=setInterval(loadScanner,4000);
    }else if(st.status!=='scanning'&&scannerPollInterval){
      clearInterval(scannerPollInterval);scannerPollInterval=null;
    }
  }catch(e){console.error('Scanner load error',e)}
}

async function loadScannerProfiles(){
  try{
    const r=await fetch('/api/whales/scanner/profiles?limit=50');
    if(!r.ok)return;
    const profiles=await r.json();
    const tbody=document.getElementById('wh-scan-profiles');
    if(!profiles||profiles.length===0){tbody.innerHTML='<tr><td colspan="11" class="empty">No scan results yet. Start the scanner or trigger a manual scan.</td></tr>';return}
    tbody.innerHTML=profiles.map(p=>{
      const addr=p.address.slice(0,6)+'…'+p.address.slice(-4);
      const scoreCls=p.compositeScore>=65?'pnl-pos':p.compositeScore>=40?'pnl-zero':'pnl-neg';
      const pnlC=p.estimatedPnlUsd>=0?'pnl-pos':'pnl-neg';
      const roiC=p.estimatedRoi>=0?'pnl-pos':'pnl-neg';
      const tags=(p.suggestedTags||[]).slice(0,3).map(t=>'<span style="font-size:10px;background:var(--surface2);padding:2px 6px;border-radius:3px;margin-right:2px">'+t+'</span>').join('');
      const tracked=p.alreadyTracked?'<span style="color:var(--green);font-size:11px">✓ Tracked</span>':'<button onclick="event.stopPropagation();promoteScanned(\\\''+p.address+'\\\')" style="background:var(--blue);color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer">Track</button>';
      const holdDisplay=p.avgHoldTimeHrs>0?(p.avgHoldTimeHrs<1?(p.avgHoldTimeHrs*60).toFixed(0)+'m':p.avgHoldTimeHrs<24?p.avgHoldTimeHrs.toFixed(1)+'h':(p.avgHoldTimeHrs/24).toFixed(1)+'d'):'-';
      return '<tr style="cursor:pointer" onclick="openScannerProfile(\\\''+p.address+'\\\')" title="Click for details">'+
        '<td><code style="font-size:11px">'+addr+'</code></td>'+
        '<td class="'+scoreCls+'">'+p.compositeScore.toFixed(0)+'</td>'+
        '<td>$'+fmt(p.totalVolumeUsd,0)+'</td>'+
        '<td>'+p.totalTrades+'</td>'+
        '<td>'+p.distinctMarkets+'</td>'+
        '<td>'+((p.closedTrades||0)>0?(p.estimatedWinRate*100).toFixed(0)+'%':'<span style="opacity:0.5">N/A</span>')+'</td>'+
        '<td class="'+pnlC+'">$'+fmt(p.estimatedPnlUsd)+'</td>'+
        '<td class="'+roiC+'">'+(p.estimatedRoi*100).toFixed(1)+'%</td>'+
        '<td>'+holdDisplay+'</td>'+
        '<td>'+tags+'</td>'+
        '<td>'+tracked+'</td></tr>';
    }).join('');
  }catch(e){console.error(e)}
}

async function openScannerProfile(address){
  const modal=document.getElementById('wh-scan-profile-modal');
  const content=document.getElementById('wh-profile-content');
  modal.style.display='block';
  content.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">Loading profile…</div>';
  try{
    const r=await fetch('/api/whales/scanner/profiles/'+address);
    if(!r.ok){content.innerHTML='<div style="color:var(--red)">Failed to load profile</div>';return}
    const p=await r.json();
    const pnlC=p.estimatedPnlUsd>=0?'var(--green)':'var(--red)';
    const roiC=p.estimatedRoi>=0?'var(--green)':'var(--red)';
    const streakC=p.currentStreak>0?'var(--green)':p.currentStreak<0?'var(--red)':'var(--muted)';
    const streakLabel=p.currentStreak>0?p.currentStreak+'W':p.currentStreak<0?Math.abs(p.currentStreak)+'L':'0';
    const holdDisplay=p.avgHoldTimeHrs>0?(p.avgHoldTimeHrs<1?(p.avgHoldTimeHrs*60).toFixed(0)+' min':p.avgHoldTimeHrs<24?p.avgHoldTimeHrs.toFixed(1)+' hrs':(p.avgHoldTimeHrs/24).toFixed(1)+' days'):'-';
    const medianDisplay=p.medianHoldTimeHrs>0?(p.medianHoldTimeHrs<1?(p.medianHoldTimeHrs*60).toFixed(0)+' min':p.medianHoldTimeHrs<24?p.medianHoldTimeHrs.toFixed(1)+' hrs':(p.medianHoldTimeHrs/24).toFixed(1)+' days'):'-';
    const tags=(p.suggestedTags||[]).map(t=>'<span style="font-size:11px;background:var(--surface2);padding:3px 8px;border-radius:4px;margin-right:4px">'+t+'</span>').join('');

    let html='<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">';
    html+='<div><h2 style="margin:0 0 4px 0;font-size:18px">🐋 Whale Profile</h2>';
    html+='<code style="font-size:13px;color:var(--muted)">'+p.address+'</code></div>';
    html+='<div style="text-align:right"><div style="font-size:32px;font-weight:700;color:'+(p.compositeScore>=65?'var(--green)':p.compositeScore>=40?'var(--yellow)':'var(--red)')+'">'+p.compositeScore+'</div><div style="font-size:11px;color:var(--muted)">Composite Score</div></div>';
    html+='</div>';
    html+='<div style="margin-bottom:12px">'+tags+'</div>';

    // Summary stats grid
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:20px">';
    const stats=[
      ['Total Volume','$'+fmt(p.totalVolumeUsd,0)],
      ['Total Trades',p.totalTrades],
      ['Closed Trades',p.closedTrades||0],
      ['Markets',p.distinctMarkets],
      ['Win Rate',(p.closedTrades||0)>0?(p.estimatedWinRate*100).toFixed(1)+'%':'N/A'],
      ['Est. PnL','<span style="color:'+pnlC+'">$'+fmt(p.estimatedPnlUsd)+'</span>'],
      ['ROI','<span style="color:'+roiC+'">'+(p.estimatedRoi*100).toFixed(2)+'%</span>'],
      ['Avg Hold Time',holdDisplay],
      ['Median Hold',medianDisplay],
      ['Largest Win','<span style="color:var(--green)">$'+fmt(p.largestWinUsd||0)+'</span>'],
      ['Largest Loss','<span style="color:var(--red)">$'+fmt(Math.abs(p.largestLossUsd||0))+'</span>'],
      ['Max Trade','$'+fmt(p.maxSingleTradeUsd,0)],
      ['Avg Trade','$'+fmt(p.avgTradeUsd)],
      ['Win Streak',p.longestWinStreak||0],
      ['Loss Streak',p.longestLossStreak||0],
      ['Current Streak','<span style="color:'+streakC+'">'+streakLabel+'</span>'],
      ['Trading Span',(p.tradingSpanDays||0).toFixed(1)+' days'],
      ['Activity Score',(p.activityScore||0).toFixed(0)],
    ];
    for(const [label,val] of stats){
      html+='<div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:4px">'+label+'</div><div style="font-size:14px;font-weight:600">'+val+'</div></div>';
    }
    html+='</div>';

    // Timestamps
    html+='<div style="display:flex;gap:16px;margin-bottom:20px;font-size:12px;color:var(--muted)">';
    html+='<span>First trade: '+(p.firstTradeTs?new Date(p.firstTradeTs).toLocaleString():'-')+'</span>';
    html+='<span>Last trade: '+(p.lastTradeTs?new Date(p.lastTradeTs).toLocaleString():'-')+'</span>';
    html+='</div>';

    // Market breakdown
    const mkt=p.marketBreakdown||[];
    if(mkt.length>0){
      html+='<h3 style="margin:0 0 10px 0;font-size:15px">Market Breakdown ('+mkt.length+' markets)</h3>';
      html+='<div style="max-height:400px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
      html+='<thead><tr style="background:var(--surface2);position:sticky;top:0">';
      html+='<th style="padding:6px 8px;text-align:left">Market</th>';
      html+='<th style="padding:6px 8px;text-align:right">Volume</th>';
      html+='<th style="padding:6px 8px;text-align:center">Trades</th>';
      html+='<th style="padding:6px 8px;text-align:center">Side</th>';
      html+='<th style="padding:6px 8px;text-align:right">PnL</th>';
      html+='<th style="padding:6px 8px;text-align:center">Entry</th>';
      html+='<th style="padding:6px 8px;text-align:center">Exit</th>';
      html+='<th style="padding:6px 8px;text-align:center">Hold</th>';
      html+='<th style="padding:6px 8px;text-align:center">Open Size</th>';
      html+='<th style="padding:6px 8px;text-align:center">Status</th>';
      html+='</tr></thead><tbody>';
      for(const m of mkt){
        const mPnlC=(m.estimatedPnlUsd||0)>=0?'var(--green)':'var(--red)';
        const sideC=m.netSide==='BUY'?'var(--green)':m.netSide==='SELL'?'var(--red)':'var(--muted)';
        const statusC=m.positionStatus==='active'?'var(--blue)':'var(--muted)';
        const mHold=(m.avgHoldTimeHrs||0)<1?((m.avgHoldTimeHrs||0)*60).toFixed(0)+'m':(m.avgHoldTimeHrs||0)<24?(m.avgHoldTimeHrs||0).toFixed(1)+'h':((m.avgHoldTimeHrs||0)/24).toFixed(1)+'d';
        html+='<tr style="border-bottom:1px solid var(--border)">';
        html+='<td style="padding:6px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(m.question||'')+'">'+((m.question||'').slice(0,45)+(m.question&&m.question.length>45?'…':''))+'</td>';
        html+='<td style="padding:6px 8px;text-align:right">$'+fmt(m.volumeUsd,0)+'</td>';
        html+='<td style="padding:6px 8px;text-align:center">'+m.trades+'</td>';
        html+='<td style="padding:6px 8px;text-align:center;color:'+sideC+'">'+m.netSide+'</td>';
        html+='<td style="padding:6px 8px;text-align:right;color:'+mPnlC+'">$'+fmt(m.estimatedPnlUsd||0)+'</td>';
        html+='<td style="padding:6px 8px;text-align:center">'+(m.avgEntryPrice||0).toFixed(3)+'</td>';
        html+='<td style="padding:6px 8px;text-align:center">'+(m.avgExitPrice||0).toFixed(3)+'</td>';
        html+='<td style="padding:6px 8px;text-align:center">'+mHold+'</td>';
        html+='<td style="padding:6px 8px;text-align:center">'+(m.openPositionSize||0).toFixed(1)+'</td>';
        html+='<td style="padding:6px 8px;text-align:center"><span style="color:'+statusC+';font-size:11px">'+((m.positionStatus||'').toUpperCase())+'</span></td>';
        html+='</tr>';
      }
      html+='</tbody></table></div>';
    }

    // Track button
    if(!p.alreadyTracked){
      html+='<div style="margin-top:20px;text-align:center"><button onclick="promoteScanned(\\\''+p.address+'\\\');document.getElementById(\\\'wh-scan-profile-modal\\\').style.display=\\\'none\\\'" style="background:var(--blue);color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">🐋 Track This Whale</button></div>';
    }else{
      html+='<div style="margin-top:20px;text-align:center;color:var(--green);font-size:14px">✓ Already Tracked</div>';
    }

    content.innerHTML=html;
  }catch(e){
    content.innerHTML='<div style="color:var(--red)">Error loading profile: '+e.message+'</div>';
  }
}

document.getElementById('wh-profile-close').addEventListener('click',()=>{
  document.getElementById('wh-scan-profile-modal').style.display='none';
});
document.getElementById('wh-scan-profile-modal').addEventListener('click',(e)=>{
  if(e.target.id==='wh-scan-profile-modal') e.target.style.display='none';
});

async function promoteScanned(address){
  try{
    const r=await fetch('/api/whales/scanner/promote/'+address,{method:'POST'});
    if(r.ok){loadScanner();loadWhales()}
  }catch(e){console.error(e)}
}

document.getElementById('wh-scan-start').addEventListener('click',async()=>{
  await fetch('/api/whales/scanner/start',{method:'POST'});
  setTimeout(loadScanner,500);
});
document.getElementById('wh-scan-stop').addEventListener('click',async()=>{
  await fetch('/api/whales/scanner/stop',{method:'POST'});
  setTimeout(loadScanner,500);
});
document.getElementById('wh-scan-trigger').addEventListener('click',async()=>{
  document.getElementById('wh-scan-st').innerHTML='<span style="color:var(--blue)">SCANNING…</span>';
  try{
    await fetch('/api/whales/scanner/scan',{method:'POST'});
    loadScanner();
  }catch(e){console.error(e);loadScanner()}
});

/* Top-level scanner controls (always visible at top of Whales tab) */
document.getElementById('wh-top-start').addEventListener('click',async()=>{
  document.getElementById('wh-top-scanner-st').innerHTML='<span style="color:var(--blue)">Starting…</span>';
  await fetch('/api/whales/scanner/start',{method:'POST'});
  setTimeout(loadScanner,500);
});
document.getElementById('wh-top-stop').addEventListener('click',async()=>{
  document.getElementById('wh-top-scanner-st').innerHTML='<span style="color:var(--yellow)">Stopping…</span>';
  await fetch('/api/whales/scanner/stop',{method:'POST'});
  setTimeout(loadScanner,500);
});
document.getElementById('wh-top-scan').addEventListener('click',async()=>{
  document.getElementById('wh-top-scanner-st').innerHTML='<span style="color:var(--blue)">SCANNING…</span>';
  try{
    await fetch('/api/whales/scanner/scan',{method:'POST'});
    loadScanner();
  }catch(e){console.error(e);loadScanner()}
});

/* ─── Cluster Signals ─── */
async function loadClusterSignals(){
  try{
    const r=await fetch('/api/whales/scanner/signals');
    if(!r.ok){document.getElementById('wh-cluster-body').innerHTML='<tr><td colspan="8" class="empty">Failed to load ('+r.status+')</td></tr>';return}
    const signals=await r.json();
    const arr=Array.isArray(signals)?signals:[];
    const high=arr.filter(s=>s.confidence>=0.7).length;
    const avgConf=arr.length>0?(arr.reduce((s,x)=>s+x.confidence,0)/arr.length):0;
    const uniqueMarkets=new Set(arr.map(s=>s.marketId)).size;
    document.getElementById('wh-cl-count').textContent=String(arr.length);
    document.getElementById('wh-cl-high').innerHTML='<span style="color:var(--green)">'+high+'</span>';
    document.getElementById('wh-cl-avg').textContent=(avgConf*100).toFixed(0)+'%';
    document.getElementById('wh-cl-markets').textContent=String(uniqueMarkets);
    const tbody=document.getElementById('wh-cluster-body');
    if(arr.length===0){tbody.innerHTML='<tr><td colspan="8" class="empty">No active cluster signals. Signals appear when multiple whales trade the same market.</td></tr>';return}
    tbody.innerHTML=arr.sort((a,b)=>b.confidence-a.confidence).map(s=>{
      const confCls=s.confidence>=0.7?'pnl-pos':s.confidence>=0.4?'pnl-zero':'pnl-neg';
      const mkt=s.marketId?(s.marketId.length>16?s.marketId.slice(0,8)+'…'+s.marketId.slice(-6):s.marketId):'?';
      const sideCls=s.side==='BUY'?'color:var(--green)':'color:var(--red)';
      const ttlMin=s.ttlMs?Math.round(s.ttlMs/60000):0;
      const created=s.createdAt?new Date(s.createdAt).toLocaleTimeString():'?';
      const whaleAddrs=(s.whaleAddresses||[]).map(a=>a.slice(0,6)+'…').join(', ')||String(s.whaleCount||0)+' whales';
      return '<tr>'+
        '<td style="font-size:11px"><code>'+mkt+'</code></td>'+
        '<td style="'+sideCls+';font-weight:600">'+(s.side||'?')+'</td>'+
        '<td style="font-size:11px" title="'+(s.whaleAddresses||[]).join(', ')+'">'+whaleAddrs+'</td>'+
        '<td>'+fmt(s.combinedSize||0,1)+'</td>'+
        '<td>$'+fmt(s.avgPrice||0,3)+'</td>'+
        '<td class="'+confCls+'">'+(s.confidence*100).toFixed(0)+'%</td>'+
        '<td style="font-size:11px">'+(ttlMin>0?ttlMin+'m':'expired')+'</td>'+
        '<td style="font-size:11px">'+created+'</td>'+
        '</tr>';
    }).join('');
  }catch(e){console.error('Cluster signals error',e);document.getElementById('wh-cluster-body').innerHTML='<tr><td colspan="8" class="empty">Error loading cluster signals</td></tr>'}
}

/* ─── Network Graph ─── */
async function loadNetworkGraph(){
  try{
    const r=await fetch('/api/whales/scanner/network');
    if(!r.ok){document.getElementById('wh-net-body').innerHTML='<tr><td colspan="5" class="empty">Failed to load ('+r.status+')</td></tr>';return}
    const edges=await r.json();
    const arr=Array.isArray(edges)?edges:[];
    const nodes=new Set();
    arr.forEach(e=>{nodes.add(e.whaleA);nodes.add(e.whaleB)});
    const strongest=arr.length>0?arr.reduce((best,e)=>e.weight>best.weight?e:best,arr[0]):null;
    const avgW=arr.length>0?(arr.reduce((s,e)=>s+e.weight,0)/arr.length):0;
    document.getElementById('wh-net-nodes').textContent=String(nodes.size);
    document.getElementById('wh-net-edges').textContent=String(arr.length);
    document.getElementById('wh-net-strongest').textContent=strongest?(strongest.whaleA.slice(0,6)+'↔'+strongest.whaleB.slice(0,6)+' ('+strongest.weight+')'):'-';
    document.getElementById('wh-net-avgw').textContent=avgW.toFixed(1);
    const tbody=document.getElementById('wh-net-body');
    if(arr.length===0){tbody.innerHTML='<tr><td colspan="5" class="empty">No network edges yet. Need at least 2 tracked whales trading shared markets.</td></tr>';return}
    tbody.innerHTML=arr.sort((a,b)=>b.weight-a.weight).slice(0,100).map(e=>{
      const wA=e.whaleA.slice(0,6)+'…'+e.whaleA.slice(-4);
      const wB=e.whaleB.slice(0,6)+'…'+e.whaleB.slice(-4);
      const wCls=e.weight>=5?'pnl-pos':e.weight>=2?'pnl-zero':'pnl-neg';
      const barW=Math.min(100,e.weight*10);
      return '<tr>'+
        '<td><code style="font-size:11px">'+wA+'</code></td>'+
        '<td><code style="font-size:11px">'+wB+'</code></td>'+
        '<td>'+(e.sharedMarkets||e.weight)+'</td>'+
        '<td class="'+wCls+'"><div style="display:flex;align-items:center;gap:6px"><div style="width:60px;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:var(--accent);border-radius:3px"></div></div>'+e.weight+'</div></td>'+
        '<td>'+(e.correlation!=null?(e.correlation*100).toFixed(0)+'%':'-')+'</td>'+
        '</tr>';
    }).join('');
  }catch(e){console.error('Network graph error',e);document.getElementById('wh-net-body').innerHTML='<tr><td colspan="5" class="empty">Error loading network graph</td></tr>'}
}

/* ─── Copy-Trade Simulator ─── */
async function loadCopySim(){
  try{
    const r=await fetch('/api/whales/scanner/copysim');
    if(!r.ok){document.getElementById('wh-cs-body').innerHTML='<tr><td colspan="9" class="empty">Failed to load ('+r.status+')</td></tr>';return}
    const results=await r.json();
    const arr=Array.isArray(results)?results:[];
    const profitable=arr.filter(x=>(x.simPnl||0)>0).length;
    const bestRoi=arr.length>0?Math.max(...arr.map(x=>x.roi||0)):0;
    const totalPnl=arr.reduce((s,x)=>s+(x.simPnl||0),0);
    document.getElementById('wh-cs-count').textContent=String(arr.length);
    document.getElementById('wh-cs-profit').innerHTML='<span style="color:var(--green)">'+profitable+'</span> / '+arr.length;
    document.getElementById('wh-cs-best').innerHTML='<span style="color:'+(bestRoi>=0?'var(--green)':'var(--red)'+'">'+(bestRoi*100).toFixed(1)+'%</span>');
    document.getElementById('wh-cs-total').innerHTML='<span class="'+(totalPnl>=0?'pnl-pos':'pnl-neg')+'">$'+fmt(totalPnl)+'</span>';
    const tbody=document.getElementById('wh-cs-body');
    if(arr.length===0){tbody.innerHTML='<tr><td colspan="9" class="empty">No copy-sim results yet. The simulator runs after whale scanning completes.</td></tr>';return}
    tbody.innerHTML=arr.sort((a,b)=>(b.roi||0)-(a.roi||0)).map(x=>{
      const addr=x.whaleAddress?(x.whaleAddress.slice(0,6)+'…'+x.whaleAddress.slice(-4)):'?';
      const pnlC=(x.simPnl||0)>=0?'pnl-pos':'pnl-neg';
      const roiC=(x.roi||0)>=0?'pnl-pos':'pnl-neg';
      const verdict=(x.roi||0)>0.05?'<span style="color:var(--green);font-weight:600">✓ COPY</span>':(x.roi||0)>0?'<span style="color:var(--yellow)">~ Maybe</span>':'<span style="color:var(--red)">✗ Skip</span>';
      return '<tr>'+
        '<td><code style="font-size:11px">'+addr+'</code></td>'+
        '<td>'+fmt(x.tradesCopied||0,0)+'</td>'+
        '<td class="'+pnlC+'">$'+fmt(x.simPnl||0)+'</td>'+
        '<td class="'+roiC+'">'+(x.roi!=null?(x.roi*100).toFixed(1)+'%':'-')+'</td>'+
        '<td>'+(x.winRate!=null?(x.winRate*100).toFixed(0)+'%':'-')+'</td>'+
        '<td>'+(x.avgSlippageBps!=null?fmt(x.avgSlippageBps,1)+' bps':'-')+'</td>'+
        '<td class="pnl-neg">'+(x.maxDrawdown!=null?'$'+fmt(Math.abs(x.maxDrawdown)):'-')+'</td>'+
        '<td>'+(x.sharpe!=null?fmt(x.sharpe,2):'-')+'</td>'+
        '<td>'+verdict+'</td>'+
        '</tr>';
    }).join('');
  }catch(e){console.error('CopySim error',e);document.getElementById('wh-cs-body').innerHTML='<tr><td colspan="9" class="empty">Error loading copy-sim results</td></tr>'}
}

/* ─── Regime State ─── */
async function loadRegime(){
  try{
    const r=await fetch('/api/whales/scanner/regime');
    if(!r.ok){document.getElementById('wh-rg-regime').textContent='Error';return}
    const st=await r.json();
    const regimeColors={BULL:'var(--green)',BEAR:'var(--red)',CHOPPY:'var(--yellow)',LOW_ACTIVITY:'var(--muted)'};
    const regimeIcons={BULL:'🐂',BEAR:'🐻',CHOPPY:'🌊',LOW_ACTIVITY:'💤'};
    const regime=st.regime||'UNKNOWN';
    document.getElementById('wh-rg-regime').innerHTML='<span style="color:'+(regimeColors[regime]||'var(--muted)')+'">'+((regimeIcons[regime]||'')+' '+regime)+'</span>';
    document.getElementById('wh-rg-confidence').textContent=st.confidence!=null?(st.confidence*100).toFixed(0)+'%':'-';
    document.getElementById('wh-rg-volatility').textContent=st.volatility!=null?(st.volatility*100).toFixed(1)+'%':'-';
    document.getElementById('wh-rg-avgchange').textContent=st.avgPriceChange!=null?(st.avgPriceChange>=0?'+':'')+fmt(st.avgPriceChange*100,1)+'%':'-';
    document.getElementById('wh-rg-active').textContent=st.activeMarkets!=null?String(st.activeMarkets):'-';
    document.getElementById('wh-rg-time').textContent=st.determinedAt?new Date(st.determinedAt).toLocaleString():'-';
    const adjEl=document.getElementById('wh-rg-adjustments');
    if(st.regime==='BULL'){
      adjEl.innerHTML='<div style="display:grid;gap:8px"><div style="padding:12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--green)"><strong>🐂 Bull Regime Active</strong><br><span style="color:var(--muted);font-size:12px">Score thresholds lowered to capture momentum-driven whales. Volume multiplier increased. Trend-following trades favored.</span></div></div>';
    }else if(st.regime==='BEAR'){
      adjEl.innerHTML='<div style="display:grid;gap:8px"><div style="padding:12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--red)"><strong>🐻 Bear Regime Active</strong><br><span style="color:var(--muted);font-size:12px">Score thresholds raised to filter out panic traders. Only high-conviction whales pass. Contrarian signals weighted higher.</span></div></div>';
    }else if(st.regime==='CHOPPY'){
      adjEl.innerHTML='<div style="display:grid;gap:8px"><div style="padding:12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--yellow)"><strong>🌊 Choppy Regime Active</strong><br><span style="color:var(--muted);font-size:12px">Neutral thresholds. Mean-reversion whales favored. Position sizing reduced to account for whipsaws.</span></div></div>';
    }else if(st.regime==='LOW_ACTIVITY'){
      adjEl.innerHTML='<div style="display:grid;gap:8px"><div style="padding:12px;background:var(--surface2);border-radius:8px;border-left:3px solid var(--muted)"><strong>💤 Low Activity</strong><br><span style="color:var(--muted);font-size:12px">Minimal whale activity detected. Scoring relaxed to capture any meaningful signals. Scanner frequency reduced to conserve rate limits.</span></div></div>';
    }else{
      adjEl.innerHTML='<p class="empty">Regime not yet determined. Run a scan first.</p>';
    }
  }catch(e){console.error('Regime error',e);document.getElementById('wh-rg-regime').textContent='Error'}
}

/* ─── API Pool ─── */
async function loadApiPool(){
  try{
    const r=await fetch('/api/whales/scanner/apipool');
    if(!r.ok){document.getElementById('wh-ap-body').innerHTML='<tr><td colspan="9" class="empty">Failed to load ('+r.status+')</td></tr>';return}
    const pool=await r.json();
    document.getElementById('wh-ap-strategy').textContent=pool.strategy||'-';
    const endpoints=pool.endpoints||[];
    document.getElementById('wh-ap-total').textContent=String(endpoints.length);
    const healthy=endpoints.filter(e=>e.healthy!==false).length;
    document.getElementById('wh-ap-healthy').innerHTML='<span style="color:'+(healthy===endpoints.length?'var(--green)':'var(--yellow)')+'">'+healthy+' / '+endpoints.length+'</span>';
    const totalReqs=endpoints.reduce((s,e)=>s+(e.requests||0),0);
    const totalFails=endpoints.reduce((s,e)=>s+(e.failures||0),0);
    document.getElementById('wh-ap-reqs').textContent=fmt(totalReqs,0);
    document.getElementById('wh-ap-fails').innerHTML=totalFails>0?'<span style="color:var(--red)">'+totalFails+'</span>':'<span style="color:var(--green)">0</span>';
    const rpm=healthy*(pool.rpmPerEndpoint||60);
    document.getElementById('wh-ap-rpm').textContent=String(rpm);
    const tbody=document.getElementById('wh-ap-body');
    if(endpoints.length===0){tbody.innerHTML='<tr><td colspan="9" class="empty">No endpoints configured</td></tr>';return}
    tbody.innerHTML=endpoints.map((ep,i)=>{
      const statusColor=ep.healthy!==false?'var(--green)':'var(--red)';
      const statusLabel=ep.healthy!==false?'● Healthy':'● Down';
      const failRate=(ep.requests||0)>0?((ep.failures||0)/(ep.requests||1)*100).toFixed(1)+'%':'0%';
      const failRateColor=((ep.failures||0)/(ep.requests||1))>0.1?'var(--red)':'var(--green)';
      const lastUsed=ep.lastUsed?new Date(ep.lastUsed).toLocaleTimeString():'-';
      return '<tr>'+
        '<td>'+(i+1)+'</td>'+
        '<td style="font-size:11px"><code>'+(ep.baseUrl||ep.url||'-')+'</code></td>'+
        '<td><span style="color:'+statusColor+';font-weight:600">'+statusLabel+'</span></td>'+
        '<td>'+fmt(ep.weight||1,1)+'</td>'+
        '<td>'+fmt(ep.requests||0,0)+'</td>'+
        '<td>'+(ep.failures||0)+'</td>'+
        '<td style="color:'+failRateColor+'">'+failRate+'</td>'+
        '<td>'+(ep.rateLimit||60)+' rpm</td>'+
        '<td style="font-size:11px">'+lastUsed+'</td>'+
        '</tr>';
    }).join('');
  }catch(e){console.error('ApiPool error',e);document.getElementById('wh-ap-body').innerHTML='<tr><td colspan="9" class="empty">Error loading API pool status</td></tr>'}
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Console tab — real-time SSE log viewer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function initConsole(){
  const conLog = document.getElementById('con-log');
  const conCount = document.getElementById('con-count');
  const conStatus = document.getElementById('con-status');
  const conStats = document.getElementById('con-stats');
  const conLevel = document.getElementById('con-level');
  const conCat = document.getElementById('con-cat');
  const conSearch = document.getElementById('con-search');
  const conAutoScroll = document.getElementById('con-autoscroll');
  const conPause = document.getElementById('con-pause');
  const conClear = document.getElementById('con-clear');

  const allEntries = [];
  let paused = false;
  let pendingRender = false;
  const MAX_DISPLAY = 2000;

  /* ── Colour maps ── */
  const levelColor = {
    DEBUG:'#6b7280', INFO:'#60a5fa', WARN:'#fbbf24',
    ERROR:'#ef4444', SUCCESS:'#34d399'
  };
  const catIcon = {
    SCAN:'🔍', SIGNAL:'📡', ORDER:'📋', FILL:'💰',
    POSITION:'📊', RISK:'🛡️', ENGINE:'⚙️', STRATEGY:'🧠',
    WALLET:'👛', SYSTEM:'🖥️', ERROR:'❌'
  };

  function formatTs(ts){
    const d=new Date(ts);
    return d.toLocaleTimeString('en-US',{hour12:false})+'.'+String(d.getMilliseconds()).padStart(3,'0');
  }

  function entryHtml(e){
    const lc=levelColor[e.level]||'#9ca3af';
    const icon=catIcon[e.category]||'📝';
    const dataStr=e.data?'<span class="con-data" title="'+escHtml(JSON.stringify(e.data,null,2))+'"> {…}</span>':'';
    return '<div class="con-line" data-level="'+e.level+'" data-cat="'+e.category+'" style="border-left:3px solid '+lc+';padding:3px 0 3px 10px;margin:1px 0">'
      +'<span style="color:#6b7280">'+formatTs(e.timestamp)+'</span> '
      +'<span style="color:'+lc+';font-weight:600;min-width:56px;display:inline-block">'+e.level+'</span> '
      +icon+' '
      +'<span style="color:#a78bfa;font-weight:500">['+e.category+']</span> '
      +'<span style="color:#e2e8f0">'+escHtml(e.message)+'</span>'
      +dataStr
      +'</div>';
  }

  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

  function matchesFilter(e){
    const lv=conLevel.value;
    const ct=conCat.value;
    const q=conSearch.value.toLowerCase();
    if(lv && e.level!==lv) return false;
    if(ct && e.category!==ct) return false;
    if(q && !e.message.toLowerCase().includes(q) && !(e.category||'').toLowerCase().includes(q)) return false;
    return true;
  }

  function renderAll(){
    const filtered=allEntries.filter(matchesFilter);
    const slice=filtered.slice(-MAX_DISPLAY);
    conLog.innerHTML=slice.map(entryHtml).join('');
    conCount.textContent=filtered.length+' entries'+(filtered.length!==allEntries.length?' ('+allEntries.length+' total)':'');
    if(conAutoScroll.checked) conLog.scrollTop=conLog.scrollHeight;
    pendingRender=false;
  }

  function scheduleRender(){
    if(!pendingRender){pendingRender=true;requestAnimationFrame(renderAll)}
  }

  function appendEntry(e){
    allEntries.push(e);
    if(allEntries.length>5000) allEntries.splice(0,allEntries.length-4000);
    if(paused) return;
    if(!matchesFilter(e)) {
      conCount.textContent=allEntries.filter(matchesFilter).length+' entries ('+allEntries.length+' total)';
      return;
    }
    conLog.insertAdjacentHTML('beforeend',entryHtml(e));
    // Trim DOM
    while(conLog.children.length>MAX_DISPLAY) conLog.removeChild(conLog.firstChild);
    conCount.textContent=allEntries.filter(matchesFilter).length+' entries'+(allEntries.length>allEntries.filter(matchesFilter).length?' ('+allEntries.length+' total)':'');
    if(conAutoScroll.checked) conLog.scrollTop=conLog.scrollHeight;
  }

  /* ── SSE connection ── */
  let evtSrc;
  function connectSSE(){
    evtSrc=new EventSource('/api/console/stream');
    evtSrc.onmessage=function(ev){
      try{
        const entry=JSON.parse(ev.data);
        appendEntry(entry);
      }catch(err){console.error('Console SSE parse error',err)}
    };
    evtSrc.onopen=function(){
      conStatus.innerHTML='<span style="color:var(--green)">● Connected</span>';
    };
    evtSrc.onerror=function(){
      conStatus.innerHTML='<span style="color:var(--red)">● Disconnected</span>';
      setTimeout(()=>{evtSrc.close();connectSSE()},3000);
    };
  }
  connectSSE();

  /* ── Controls ── */
  conLevel.addEventListener('change',scheduleRender);
  conCat.addEventListener('change',scheduleRender);
  conSearch.addEventListener('input',scheduleRender);
  conClear.addEventListener('click',()=>{
    allEntries.length=0;
    conLog.innerHTML='';
    conCount.textContent='0 entries';
  });
  conPause.addEventListener('click',()=>{
    paused=!paused;
    conPause.textContent=paused?'▶ Resume':'⏸ Pause';
    if(!paused) scheduleRender();
  });

  /* ── Periodic stats ── */
  async function loadConStats(){
    try{
      const r=await fetch('/api/console/stats');
      const s=await r.json();
      const parts=[];
      parts.push('Total: '+s.total);
      if(s.byLevel){
        for(const[k,v]of Object.entries(s.byLevel)){
          parts.push('<span style="color:'+(levelColor[k]||'#9ca3af')+'">'+k+': '+v+'</span>');
        }
      }
      conStats.innerHTML=parts.join(' &middot; ');
    }catch(e){}
  }
  setInterval(loadConStats,5000);
  loadConStats();

  /* ── Data tooltip on hover ── */
  conLog.addEventListener('mouseover',function(ev){
    const t=ev.target.closest('.con-data');
    if(!t) return;
    t.style.cursor='pointer';
  });
  conLog.addEventListener('click',function(ev){
    const t=ev.target.closest('.con-data');
    if(!t) return;
    const title=t.getAttribute('title');
    if(!title) return;
    // Show data in a floating tooltip
    let tip=document.getElementById('con-tooltip');
    if(!tip){
      tip=document.createElement('div');
      tip.id='con-tooltip';
      tip.style.cssText='position:fixed;z-index:9999;background:#1c2330;border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:11px;color:#e2e8f0;max-width:500px;max-height:300px;overflow:auto;white-space:pre-wrap;font-family:monospace;box-shadow:0 8px 32px rgba(0,0,0,.5)';
      document.body.appendChild(tip);
    }
    tip.textContent=title;
    tip.style.display='block';
    const rect=t.getBoundingClientRect();
    tip.style.top=(rect.bottom+4)+'px';
    tip.style.left=Math.min(rect.left,window.innerWidth-520)+'px';
    function hideOnClick(e2){
      if(!tip.contains(e2.target)){tip.style.display='none';document.removeEventListener('click',hideOnClick)}
    }
    setTimeout(()=>document.addEventListener('click',hideOnClick),50);
  });
})();

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Console sub-tab switching
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.querySelectorAll('.con-sub-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.con-sub-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.con-sub-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const panelId='cpanel-'+btn.dataset.cpanel;
    const panel=document.getElementById(panelId);
    if(panel) panel.classList.add('active');
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Trade Log — live trade feed with total PnL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function initTradeLog(){
  const tbody=document.getElementById('tl-tbody');
  const totalPnlEl=document.getElementById('tl-total-pnl');
  const totalCountEl=document.getElementById('tl-total-count');
  const winCountEl=document.getElementById('tl-win-count');
  const lossCountEl=document.getElementById('tl-loss-count');
  const volumeEl=document.getElementById('tl-volume');
  const showingEl=document.getElementById('tl-showing');
  const emptyEl=document.getElementById('tl-empty');
  const tableWrap=document.getElementById('tl-table-wrap');
  const lastUpdateEl=document.getElementById('tl-last-update');
  const sideFilter=document.getElementById('tl-side-filter');
  const walletFilter=document.getElementById('tl-wallet-filter');
  const searchInput=document.getElementById('tl-search');
  const autoScroll=document.getElementById('tl-autoscroll');

  let allTrades=[];
  let summary={totalTrades:0,totalRealizedPnl:0,winCount:0,lossCount:0,totalVolume:0};
  let knownWallets=new Set();
  const MAX_DISPLAY=1000;

  function tlFmt(v,d){return Number(v).toFixed(d===undefined?2:d)}
  function tlPnlCls(v){return v>0?'pnl-pos':v<0?'pnl-neg':'pnl-zero'}

  function matchesFilter(t){
    const sf=sideFilter.value;
    const wf=walletFilter.value;
    const q=searchInput.value.toLowerCase();
    if(sf && t.side!==sf) return false;
    if(wf && t.walletId!==wf) return false;
    if(q){
      const haystack=(t.marketId+' '+t.walletName+' '+t.walletId+' '+t.orderId+' '+t.strategy).toLowerCase();
      if(!haystack.includes(q)) return false;
    }
    return true;
  }

  function renderTradeRow(t,idx){
    const time=new Date(t.timestamp).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const date=new Date(t.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const sideCls=t.side==='BUY'?'side-buy':'side-sell';
    const sideBadge=t.side==='BUY'?'tl-badge tl-badge-buy':'tl-badge tl-badge-sell';
    return '<tr>'+
      '<td style="color:var(--muted)">'+idx+'</td>'+
      '<td><div style="font-size:12px">'+time+'</div><div style="font-size:10px;color:var(--muted)">'+date+'</div></td>'+
      '<td><span class="tl-wallet-tag" title="'+escHtml(t.walletId)+'">'+escHtml(t.walletName)+'</span></td>'+
      '<td><span class="tl-market-id" title="'+escHtml(t.marketId)+'">'+escHtml(t.marketId.length>24?t.marketId.slice(0,10)+'…'+t.marketId.slice(-10):t.marketId)+'</span><div class="ext-link-row">'+renderPolyLinks(t.marketId)+'</div></td>'+
      '<td><span class="'+sideBadge+'">'+t.side+'</span></td>'+
      '<td><span class="o-'+t.outcome+'">'+t.outcome+'</span></td>'+
      '<td>$'+tlFmt(t.price,4)+'</td>'+
      '<td>'+tlFmt(t.size,1)+'</td>'+
      '<td>$'+tlFmt(t.cost,2)+'</td>'+
      '<td class="pnl-cell '+tlPnlCls(t.realizedPnl)+'">'+(t.realizedPnl>=0?'+':'')+tlFmt(t.realizedPnl,4)+'</td>'+
      '<td class="pnl-cell '+tlPnlCls(t.cumulativePnl)+'">'+(t.cumulativePnl>=0?'+':'')+tlFmt(t.cumulativePnl,4)+'</td>'+
      '<td>$'+tlFmt(t.balanceAfter,2)+'</td>'+
      '</tr>';
  }

  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

  function renderAll(){
    const filtered=allTrades.filter(matchesFilter);
    const display=filtered.slice(-MAX_DISPLAY).reverse();

    if(display.length===0){
      tbody.innerHTML='';
      tableWrap.style.display='none';
      emptyEl.style.display='block';
      showingEl.textContent='Showing 0 trades';
      return;
    }

    tableWrap.style.display='block';
    emptyEl.style.display='none';

    const rows=display.map((t,i)=>renderTradeRow(t,filtered.length-i)).join('');
    tbody.innerHTML=rows;
    showingEl.textContent='Showing '+display.length+(filtered.length>MAX_DISPLAY?' of '+filtered.length:'')+' trades';

    if(autoScroll.checked){
      tableWrap.scrollTop=0; // newest is at top
    }
  }

  function updateSummary(){
    totalPnlEl.textContent=(summary.totalRealizedPnl>=0?'+$':'−$')+Math.abs(summary.totalRealizedPnl).toFixed(2);
    totalPnlEl.className='tl-total-pnl '+tlPnlCls(summary.totalRealizedPnl);
    totalCountEl.textContent=summary.totalTrades;
    winCountEl.textContent=summary.winCount;
    lossCountEl.textContent=summary.lossCount;
    volumeEl.textContent='$'+Number(summary.totalVolume).toFixed(0);
  }

  function updateWalletFilter(){
    for(const t of allTrades){
      if(!knownWallets.has(t.walletId)){
        knownWallets.add(t.walletId);
        const opt=document.createElement('option');
        opt.value=t.walletId;
        opt.textContent=t.walletName||t.walletId;
        walletFilter.appendChild(opt);
      }
    }
  }

  const TRADE_LOG_FETCH_LIMIT = 3000;

  async function fetchTrades(){
    try{
      const r=await fetch('/api/trades/all?limit='+TRADE_LOG_FETCH_LIMIT+'&offset=0');
      if(!r.ok) return;
      const d=await r.json();
      allTrades=d.trades||[];
      summary=d.summary||{totalTrades:0,totalRealizedPnl:0,winCount:0,lossCount:0,totalVolume:0};
      updateWalletFilter();
      updateSummary();
      renderAll();
      lastUpdateEl.textContent='Updated '+new Date().toLocaleTimeString();
    }catch(e){
      console.error('Trade log fetch error',e);
    }
  }

  /* ── Controls ── */
  sideFilter.addEventListener('change',renderAll);
  walletFilter.addEventListener('change',renderAll);
  searchInput.addEventListener('input',renderAll);

  /* ── Polling ── */
  fetchTrades();
  setInterval(fetchTrades,2000);
})();

/* ─── Fetch dashboard data via REST (fallback + initial load) ─── */
async function fetchDashboardData(){
  try{
    const r = await fetch('/api/data');
    const d = await r.json();
    currentData = d;
    $('#hdr-ts').textContent = new Date(d.generatedAt).toLocaleString();
    renderSummary(d);
    renderWallets(d.wallets);
    void fetchRuntimeCounters();
  }catch(e){console.error('fetchDashboardData error',e)}
}

/* ─── Real-time SSE stream ─── */
let sse = null;
let sseConnected = false;
function connectSSE(){
  if(sse) sse.close();
  sseConnected = false;
  try{
    sse = new EventSource('/api/stream');
    sse.addEventListener('dashboard', function(ev){
      try{
        sseConnected = true;
        const d = JSON.parse(ev.data);
        currentData = d;
        $('#hdr-ts').textContent = new Date(d.generatedAt).toLocaleString();
        renderSummary(d);
        renderWallets(d.wallets);
      }catch(e){console.error('SSE parse error',e)}
    });
    sse.onerror = function(){
      sseConnected = false;
      sse.close();
      setTimeout(connectSSE, 3000);
    };
  }catch(e){
    sseConnected = false;
    setTimeout(connectSSE, 3000);
  }
}

/* ─── Refresh for non-SSE data (wallet list, etc) ─── */
async function refresh(){
  try{
    const walletsR = await fetch('/api/wallets');
    walletList = await walletsR.json();
    void refreshMarketSlugCache(false);
    void fetchRuntimeCounters();
    renderWalletTable(walletList);
    populateAnalyticsDropdown();
    if(strategies.length) renderStrategies(strategies, walletList);
    /* If SSE is not connected, poll /api/data as fallback */
    if(!sseConnected) await fetchDashboardData();
  }catch(e){$('#hdr-ts').textContent='Error \u2014 retrying\u2026'}
}

/* ─── Boot ─── */
const killBtn = document.getElementById('kill-switch-btn');
if(killBtn) killBtn.addEventListener('click', triggerKillSwitch);

fetchDashboardData();
void refreshMarketSlugCache(true);
populateStrategyDropdown().then(()=>refresh());
connectSSE();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}

