'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Route-level template for /resume/3
 * - Neutralizes required guards and "必須" markers
 * - Injects Final Education radios and School cards UI into the existing form
 * - Adds an always-enabled Next link to /resume/4
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [schools, setSchools] = useState<Array<{ id: number }>>([{ id: 1 }]);

  useEffect(() => {
    const main = document.querySelector('main') || document.body;
    const form = (main?.querySelector('form') as HTMLFormElement | null) ?? null;
    if (!form) return;

    // Disable built-in validation
    form.setAttribute('noValidate', 'true');
    form.querySelectorAll('[required]').forEach((el) => el.removeAttribute('required'));
    form.querySelectorAll('[aria-required="true"]').forEach((el) => el.setAttribute('aria-required', 'false'));

    // Hide "必須" badges
    Array.from(form.querySelectorAll('*')).forEach((el) => {
      const text = (el.textContent || '').trim();
      if (text === '必須') {
        (el as HTMLElement).style.display = 'none';
      }
    });

    // Ensure buttons stay enabled
    form.querySelectorAll('button[disabled], [aria-disabled="true"]').forEach((el) => {
      el.removeAttribute('disabled');
      el.setAttribute('aria-disabled', 'false');
    });

    // Hide existing final education sections if present
    Array.from(form.querySelectorAll('h2, legend, label')).forEach((el) => {
      if ((el.textContent || '').includes('最終学歴')) {
        const section = el.closest('section') || el.parentElement;
        if (section) {
          (section as HTMLElement).style.display = 'none';
        }
      }
    });

    const host = document.createElement('div');
    host.id = 'resume3-augment';
    host.style.marginTop = '12px';
    form.appendChild(host);
    setPortalHost(host);

    return () => {
      if (host.parentElement) {
        host.parentElement.removeChild(host);
      }
    };
  }, []);

  const addSchool = () => setSchools((prev) => [...prev, { id: Date.now() }]);

  return (
    <>
      {children}
      <style>{`
        #resume3-augment .r3-row { margin-top: 12px; }
        #resume3-augment .r3-pill {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #ccc);
          background: #fff;
          color: var(--color-text, #333);
          cursor: pointer;
          user-select: none;
        }
        #resume3-augment .r3-radio {
          position: absolute;
          opacity: 0;
          width: 1px; height: 1px;
          pointer-events: none;
        }
        #resume3-augment .r3-radio:focus-visible + .r3-pill {
          outline: 2px solid var(--color-primary, #3A75C4);
          outline-offset: 2px;
        }
        #resume3-augment .r3-radio:checked + .r3-pill {
          background: var(--color-primary, #3A75C4);
          color: #fff;
          border-color: transparent;
        }
        #resume3-augment .r3-card {
          border: 1px solid var(--color-border, #e5e7eb);
          background: #fff;
          border-radius: 12px;
          padding: 12px;
        }
        #resume3-augment .r3-input {
          width: 100%;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 8px;
          padding: 8px;
          margin-top: 6px;
          background: #fff;
        }
        #resume3-augment .r3-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        #resume3-augment .r3-next {
          display: block;
          width: 100%;
          text-align: center;
          font-weight: 700;
          padding: 12px 0;
          border-radius: 10px;
          color: #fff;
          background: var(--color-primary, #3A75C4);
          text-decoration: none;
        }
        #resume3-augment .r3-add {
          border: 1px solid var(--color-border, #e5e7eb);
          background: #fff;
          color: var(--color-text, #333);
          padding: 8px 12px;
          border-radius: 10px;
          cursor: pointer;
        }
        #resume3-augment h2 { font-weight: 600; margin: 8px 0; }
        #resume3-augment .r3-muted { color: #6b7280; font-size: 12px; }
      `}</style>
      {portalHost &&
        createPortal(
          <div>
            <section className="r3-row" aria-label="最終学歴">
              <h2>最終学歴</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <input id="r3-final-high" className="r3-radio" type="radio" name="finalEdu" value="high" defaultChecked />
                  <label htmlFor="r3-final-high" className="r3-pill">高校</label>
                </div>
                <div>
                  <input id="r3-final-univ" className="r3-radio" type="radio" name="finalEdu" value="university" />
                  <label htmlFor="r3-final-univ" className="r3-pill">大学</label>
                </div>
                <div>
                  <input id="r3-final-grad" className="r3-radio" type="radio" name="finalEdu" value="graduate" />
                  <label htmlFor="r3-final-grad" className="r3-pill">大学院</label>
                </div>
                <div>
                  <input id="r3-final-other" className="r3-radio" type="radio" name="finalEdu" value="other" />
                  <label htmlFor="r3-final-other" className="r3-pill">その他</label>
                </div>
              </div>
              <div className="r3-muted">クリックで選択色が反映されます（JSステート不使用）。</div>
            </section>

            <section className="r3-row" aria-label="学校情報">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2>学校情報</h2>
                <button type="button" className="r3-add" onClick={addSchool} aria-label="学校を追加">
                  学校を追加
                </button>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {schools.map((school, index) => (
                  <div key={school.id} className="r3-card">
                    <div style={{ display: 'grid', gap: 8 }}>
                      <label>
                        <span className="r3-muted">学校名</span>
                        <input className="r3-input" type="text" name={`schools[${index}][name]`} />
                      </label>
                      <label>
                        <span className="r3-muted">学部・学科</span>
                        <input className="r3-input" type="text" name={`schools[${index}][department]`} />
                      </label>
                      <div className="r3-grid-2">
                        <label>
                          <span className="r3-muted">入学年月</span>
                          <input className="r3-input" type="month" name={`schools[${index}][start]`} />
                        </label>
                        <label>
                          <span className="r3-muted">卒業(予定)年月</span>
                          <input className="r3-input" type="month" name={`schools[${index}][end]`} />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="r3-row" style={{ marginBottom: 12 }}>
              <a href="/resume/4" className="r3-next">次へ</a>
            </div>
          </div>,
          portalHost
        )}
    </>
  );
}
