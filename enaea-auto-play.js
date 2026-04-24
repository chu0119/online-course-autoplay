// ==UserScript==
// @name         Online Course Auto-Play Assistant
// @namespace    online-course-autoplay
// @version      2.2
// @description  Auto-play next episode when current one finishes, with a floating progress panel
// @match        https://study.enaea.edu.cn/viewerforccvideo*
// @match        https://study.enaea.edu.cn/viewerforicourse*
// @match        https://study.enaea.edu.cn/circleIndexRedirect*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ============ 配置 ============
    var SPEED = 1;
    var CHECK_MS = 5000;
    var SWITCH_DELAY = 2000;

    var switching = false;
    var courseDoneCount = parseInt(localStorage.getItem('eap_done_count') || '0');
    var videoHasPlayed = false;
    var courseDoneFired = false;       // guard: courseAllDone 只调用一次

    function log(msg) {
        console.log('%c[自动连播] ' + msg, 'color: #22c55e; font-weight: bold');
    }

    function esc(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ============ 页面类型判断 ============
    var path = location.pathname;
    var isVideoPage = path.indexOf('viewerforccvideo') > -1 || path.indexOf('viewerforicourse') > -1;
    var isListPage = path.indexOf('circleIndexRedirect') > -1;

    // ============ 获取视频元素（精确选择器） ============
    function getVideo() {
        return document.querySelector('#J_CC_videoPlayerDiv video') || document.querySelector('video');
    }

    // ================================================================
    //  GUI 面板
    // ================================================================

    var panel = null;
    var panelContent = null;

    function createPanel() {
        if (document.getElementById('eap-panel')) return;

        var savedPos = JSON.parse(localStorage.getItem('eap_panel_pos') || '{}');

        panel = document.createElement('div');
        panel.id = 'eap-panel';
        panel.innerHTML =
            '<div id="eap-header">' +
            '  <span id="eap-title">ENAEA 自动连播</span>' +
            '  <span id="eap-controls">' +
            '    <span id="eap-min" title="最小化">−</span>' +
            '  </span>' +
            '</div>' +
            '<div id="eap-body"></div>';

        var s = document.createElement('style');
        s.textContent = [
            '#eap-panel{position:fixed;z-index:999999;width:260px;font-family:"Microsoft YaHei",sans-serif;font-size:13px;color:#e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.45);background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(255,255,255,.08)}',
            '#eap-panel *{margin:0;padding:0;box-sizing:border-box}',
            '#eap-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(0,0,0,.25);cursor:move;user-select:none}',
            '#eap-title{font-weight:600;font-size:14px;color:#22c55e}',
            '#eap-controls span{cursor:pointer;margin-left:8px;font-size:16px;color:#94a3b8;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px}',
            '#eap-controls span:hover{background:rgba(255,255,255,.1);color:#fff}',
            '#eap-body{padding:12px 14px;max-height:400px;overflow-y:auto}',
            '#eap-body::-webkit-scrollbar{width:4px}',
            '#eap-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}',
            '.eap-course-name{font-size:13px;font-weight:600;color:#f1f5f9;margin-bottom:8px;line-height:1.3;word-break:break-all}',
            '.eap-section-label{font-size:11px;color:#64748b;margin:8px 0 4px;letter-spacing:.5px}',
            '.eap-ep{display:flex;align-items:center;padding:5px 8px;margin:2px 0;border-radius:5px;font-size:12px;transition:background .2s}',
            '.eap-ep.is-current{background:rgba(34,197,94,.12)}',
            '.eap-ep.is-done{opacity:.55}',
            '.eap-ep-icon{width:18px;text-align:center;flex-shrink:0}',
            '.eap-ep-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 6px;color:#cbd5e1}',
            '.eap-ep.is-current .eap-ep-name{color:#22c55e}',
            '.eap-ep-pct{flex-shrink:0;font-size:11px;color:#64748b;min-width:36px;text-align:right}',
            '.eap-ep.is-current .eap-ep-pct{color:#22c55e}',
            '.eap-ep.is-done .eap-ep-pct{color:#22c55e}',
            '.eap-bar-wrap{height:6px;background:rgba(255,255,255,.06);border-radius:3px;margin:8px 0 4px;overflow:hidden}',
            '.eap-bar-fill{height:100%;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:3px;transition:width .5s ease}',
            '.eap-stat{font-size:11px;color:#64748b;display:flex;justify-content:space-between}',
            '.eap-status{text-align:center;padding:16px 0;font-size:13px;color:#94a3b8}',
            '.eap-status .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:6px;animation:eap-pulse 1.5s infinite}',
            '@keyframes eap-pulse{0%,100%{opacity:1}50%{opacity:.3}}',
            '.eap-course-ep{display:flex;align-items:center;padding:5px 8px;margin:2px 0;border-radius:5px;font-size:12px}',
            '.eap-course-name-list{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1;margin:0 6px}',
            '.eap-course-pct{flex-shrink:0;font-size:11px;color:#64748b;min-width:36px;text-align:right}'
        ].join('\n');
        document.documentElement.appendChild(s);
        document.body.appendChild(panel);

        panel.style.top = (savedPos.top || 20) + 'px';
        panel.style.left = (savedPos.left || 20) + 'px';

        panelContent = document.getElementById('eap-body');

        // 拖拽
        var dragging = false, ox = 0, oy = 0;
        var header = document.getElementById('eap-header');
        header.addEventListener('mousedown', function(e) {
            if (e.target.id === 'eap-min') return;
            dragging = true;
            ox = e.clientX - panel.offsetLeft;
            oy = e.clientY - panel.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            panel.style.left = (e.clientX - ox) + 'px';
            panel.style.top = (e.clientY - oy) + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', function() {
            if (dragging) {
                dragging = false;
                localStorage.setItem('eap_panel_pos', JSON.stringify({ top: panel.offsetTop, left: panel.offsetLeft }));
            }
        });

        // 最小化
        var minimized = false;
        var minBtn = document.getElementById('eap-min');
        minBtn.addEventListener('click', function() {
            minimized = !minimized;
            panelContent.style.display = minimized ? 'none' : 'block';
            minBtn.textContent = minimized ? '+' : '−';
        });
    }

    // 渲染视频播放页面板
    function renderVideoPanel(episodes, courseTitle) {
        if (!panelContent) return;

        var done = 0, total = episodes.length;
        episodes.forEach(function(ep) {
            if (ep.progress >= 100) done++;
        });
        var pct = total > 0 ? Math.round(done / total * 100) : 0;

        var video = getVideo();
        var curTime = video ? formatTime(video.currentTime) : '--:--';
        var durTime = (video && video.duration > 0) ? formatTime(video.duration) : '--:--';

        var html = '';

        html += '<div class="eap-course-name">' + esc(courseTitle || '加载中...') + '</div>';

        html += '<div class="eap-section-label">分集列表</div>';
        episodes.forEach(function(ep) {
            var cls = 'eap-ep';
            if (ep.isCurrent) cls += ' is-current';
            if (ep.progress >= 100) cls += ' is-done';

            var icon = ep.isCurrent ? '<span style="color:#22c55e">▶</span>'
                     : ep.progress >= 100 ? '<span style="color:#22c55e">✓</span>'
                     : '<span style="color:#475569">○</span>';

            var timeInfo = '';
            if (ep.isCurrent && video && video.duration > 0) {
                timeInfo = curTime + '/' + durTime;
            }

            html += '<div class="' + cls + '">';
            html += '  <span class="eap-ep-icon">' + icon + '</span>';
            html += '  <span class="eap-ep-name">' + esc(ep.title) + '</span>';
            html += '  <span class="eap-ep-pct">' + (timeInfo || ep.progress + '%') + '</span>';
            html += '</div>';
        });

        html += '<div class="eap-bar-wrap"><div class="eap-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '<div class="eap-stat"><span>已完成 ' + done + '/' + total + ' 集</span><span>' + pct + '%</span></div>';

        // 状态行
        var nextEp = null;
        for (var i = 0; i < episodes.length; i++) {
            if (episodes[i].progress < 100) { nextEp = episodes[i]; break; }
        }
        html += '<div class="eap-section-label">状态</div>';
        if (courseDoneFired) {
            html += '<div style="font-size:12px;color:#22c55e;padding:4px 0">本课程已完成，即将跳转下一门...</div>';
        } else if (switching) {
            html += '<div style="font-size:12px;color:#facc15;padding:4px 0">切换中...</div>';
        } else if (nextEp) {
            html += '<div style="font-size:12px;color:#94a3b8;padding:4px 0"><span class="dot"></span>播放中，下一集：' + esc(nextEp.title) + '</div>';
        } else {
            html += '<div style="font-size:12px;color:#22c55e;padding:4px 0">本课程已完成，即将跳转下一门...</div>';
        }

        panelContent.innerHTML = html;
    }

    // 渲染课程列表面板
    function renderListPanel(status) {
        if (!panelContent) return;

        var html = '<div class="eap-status"><span class="dot"></span>' + esc(status || '正在查找未完成课程...') + '</div>';
        html += '<div class="eap-section-label">统计</div>';
        html += '<div style="font-size:12px;color:#94a3b8;padding:4px 0">已连续完成: ' + courseDoneCount + ' 门课程</div>';

        panelContent.innerHTML = html;
    }

    function renderListPanelCourses(courses) {
        if (!panelContent) return;

        var html = '<div class="eap-section-label">课程列表 (' + courses.length + '门)</div>';
        courses.forEach(function(c) {
            var icon = c.pct >= 100 ? '<span style="color:#22c55e">✓</span>' : '<span style="color:#facc15">○</span>';
            html += '<div class="eap-course-ep">';
            html += '  <span class="eap-ep-icon">' + icon + '</span>';
            html += '  <span class="eap-course-name-list">' + esc(c.title) + '</span>';
            html += '  <span class="eap-course-pct">' + c.pct + '%</span>';
            html += '</div>';
        });
        html += '<div class="eap-section-label" style="margin-top:8px">统计</div>';
        html += '<div style="font-size:12px;color:#94a3b8;padding:4px 0">已连续完成: ' + courseDoneCount + ' 门课程</div>';

        panelContent.innerHTML = html;
    }

    function formatTime(s) {
        if (!s || isNaN(s) || !isFinite(s)) return '--:--';
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = Math.floor(s % 60);
        if (h > 0) {
            return h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
        }
        return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    // ================================================================
    //  视频播放页逻辑
    // ================================================================

    function getEpisodes() {
        var items = document.querySelectorAll('li.cvtb-MCK-course-content');
        var eps = [];
        items.forEach(function(li, i) {
            var pEl = li.querySelector('.cvtb-MCK-CsCt-studyProgress');
            var progress = pEl ? (parseInt(pEl.textContent) || 0) : 0;
            var raw = (li.textContent || '').trim();
            var title = raw.replace(/\d{2}:\d{2}:\d{2}/g, '').replace(/\d+%/g, '').replace(/https?:\S*/g, '').trim();
            title = title.split('\n')[0].substring(0, 30);
            if (!title) title = '第' + (i + 1) + '集';
            eps.push({
                li: li,
                progressEl: pEl,
                progress: progress,
                title: title,
                isCurrent: li.classList.contains('current'),
                index: i
            });
        });
        return eps;
    }

    function getCourseTitle() {
        var selectors = [
            '.cvtb-top-list-item',
            '.CB-BA-course-title',
            '.course-view-toolbar .cvtb-top-list-item'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            var text = el ? (el.textContent || '').trim() : '';
            if (text.length > 0 && text.length < 100) return text.substring(0, 40);
        }
        return '';
    }

    function switchToEpisode(ep) {
        if (switching) return;
        switching = true;
        log('切换到: ' + ep.title);
        ep.li.click();
        setTimeout(function() {
            if (!ep.li.classList.contains('current')) {
                log('点击li未生效，尝试进度元素');
                if (ep.progressEl) ep.progressEl.click();
            }
        }, 500);
        setTimeout(function() { switching = false; }, SWITCH_DELAY + 1000);
    }

    function courseAllDone() {
        if (courseDoneFired) return;
        courseDoneFired = true;
        log('本课程全部完成！');
        courseDoneCount++;
        localStorage.setItem('eap_done_count', courseDoneCount.toString());
        localStorage.setItem('eap_course_done', JSON.stringify({ ts: Date.now(), url: location.href }));
        var circleId = new URLSearchParams(location.search).get('circleId');
        if (circleId) {
            setTimeout(function() {
                location.href = '/circleIndexRedirect.do?circleId=' + circleId;
            }, 3000);
        }
    }

    function videoPageLoop() {
        dismissDialogs();
        applySpeed();

        var episodes = getEpisodes();
        if (episodes.length === 0) return;

        var courseTitle = getCourseTitle();
        var current = null;
        for (var i = 0; i < episodes.length; i++) {
            if (episodes[i].isCurrent) { current = episodes[i]; break; }
        }

        renderVideoPanel(episodes, courseTitle);

        if (!current || switching || courseDoneFired) return;

        var video = getVideo();
        if (!video || video.duration <= 0) return;

        // 标记视频已开始播放
        if (video.currentTime > 1 && !video.paused) {
            videoHasPlayed = true;
        }

        // 只有本次会话真正播放过，且播放到了结尾才切换
        var videoEnded = videoHasPlayed && (video.ended || video.currentTime >= video.duration - 1);

        if (!videoEnded) return;

        log('"' + current.title + '" 播放完毕，准备切换');

        // 找下一个未完成的
        var next = null;
        for (var j = current.index + 1; j < episodes.length; j++) {
            if (episodes[j].progress < 100) { next = episodes[j]; break; }
        }
        if (!next) {
            for (var k = 0; k < episodes.length; k++) {
                if (episodes[k].progress < 100) { next = episodes[k]; break; }
            }
        }

        if (next) {
            videoHasPlayed = false;
            setTimeout(function() { switchToEpisode(next); }, SWITCH_DELAY);
        } else {
            courseAllDone();
        }
    }

    // ================================================================
    //  课程列表页逻辑
    // ================================================================

    var listTabClicked = false;
    var listCourseClicked = false;

    function listPageLoop() {
        // 监听完成信号
        var signal = localStorage.getItem('eap_course_done');
        if (signal) {
            try {
                var data = JSON.parse(signal);
                if (Date.now() - data.ts < 30000) {
                    localStorage.removeItem('eap_course_done');
                    log('收到课程完成信号，刷新页面选下一门');
                    renderListPanel('课程已完成，正在刷新...');
                    setTimeout(function() { location.reload(); }, 2000);
                    return;
                }
            } catch(e) {}
            // 旧信号，清除
            localStorage.removeItem('eap_course_done');
        }

        // 切到未完成tab（只点一次）
        if (!listTabClicked) {
            var tabs = document.querySelectorAll('.customcur-tab-text');
            if (tabs.length > 1) {
                tabs[1].click();
                listTabClicked = true;
                log('已切换到未完成tab');
            }
        }

        // 查找课程列表
        var rows = document.querySelectorAll('#J_myOptionRecords tbody tr');
        if (rows.length === 0) {
            renderListPanel('等待课程列表加载...');
            return;
        }

        var courses = [];
        rows.forEach(function(row) {
            var pEl = row.querySelector('.progressvalue');
            var tEl = row.querySelector('.course-title');
            var btn = row.querySelector('a.golearn');
            if (!pEl || !btn) return;
            var pct = parseInt(pEl.textContent) || 0;
            var title = tEl ? (tEl.getAttribute('title') || tEl.textContent.trim()) : '';
            title = title.substring(0, 35);
            courses.push({ row: row, pct: pct, title: title, btn: btn });
        });

        if (courses.length === 0) {
            renderListPanel('未找到课程');
            return;
        }

        renderListPanelCourses(courses);

        // 只自动选课一次
        if (listCourseClicked) return;

        var unfinished = null;
        for (var i = 0; i < courses.length; i++) {
            if (courses[i].pct < 100) { unfinished = courses[i]; break; }
        }

        if (unfinished) {
            listCourseClicked = true;
            log('自动选择课程: ' + unfinished.title);
            setTimeout(function() {
                unfinished.btn.click();
            }, 2000);
        } else {
            var nextBtn = document.querySelector('#J_myOptionRecords_next');
            if (nextBtn && !nextBtn.classList.contains('paginate_button_disabled')) {
                log('当前页全部完成，翻页...');
                listTabClicked = false;   // 翻页后需要重新点击tab
                listCourseClicked = false; // 翻页后需要重新选课
                nextBtn.click();
            } else {
                log('所有课程已完成！');
                renderListPanel('所有课程已完成！');
            }
        }
    }

    // ================================================================
    //  通用功能
    // ================================================================

    function dismissDialogs() {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
            var t = btns[i].textContent.trim();
            if (t !== '继续学习') continue;
            var dialog = btns[i].closest('.el-dialog, .dialog-box, [role="dialog"]');
            if (dialog && dialog.offsetHeight > 0) {
                btns[i].click();
                log('关闭弹窗: ' + t);
                return;
            }
        }
    }

    function applySpeed() {
        if (SPEED <= 1) return;
        var v = getVideo();
        if (v && v.playbackRate !== SPEED) v.playbackRate = SPEED;
    }

    if (SPEED > 1) {
        var d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
        Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
            get: d.get,
            set: function(v) { d.set.call(this, SPEED); },
            configurable: true
        });
    }

    // ================================================================
    //  启动
    // ================================================================

    log('脚本启动 v2.2 | 页面: ' + (isVideoPage ? '播放页' : isListPage ? '列表页' : '未知'));

    setTimeout(function() {
        createPanel();

        if (isVideoPage) {
            var episodes = getEpisodes();
            var courseTitle = getCourseTitle();
            renderVideoPanel(episodes, courseTitle);

            // 阶段1：如果当前集进度已100%，跳到第一个未完成的集
            var current = null;
            for (var i = 0; i < episodes.length; i++) {
                if (episodes[i].isCurrent) { current = episodes[i]; break; }
            }
            if (current && current.progress >= 100) {
                var next = null;
                for (var j = 0; j < episodes.length; j++) {
                    if (episodes[j].progress < 100) { next = episodes[j]; break; }
                }
                if (next) {
                    log('当前集已完成(' + current.progress + '%)，跳到: ' + next.title);
                    switchToEpisode(next);
                } else {
                    log('所有分集已100%，跳转下一门课');
                    courseAllDone();
                }
            } else {
                log('当前集未完成，正常播放中...');
            }

            // 阶段2：启动播放监控循环
            setTimeout(function() {
                log('自动检测循环启动');
                setInterval(videoPageLoop, CHECK_MS);
            }, 10000);
        } else if (isListPage) {
            setInterval(listPageLoop, CHECK_MS);
            listPageLoop();
        }
    }, 3000);

})();
