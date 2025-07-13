
  function renderStatusBlock(statusCode, title, noteLabel, placeholder) {
    if (statusCode === 1) {
      const user = d.user || '未知使用者';
      const created = d.createdAt?.toDate?.();
      const timeStr = created ? `${created.getFullYear()}/${created.getMonth()+1}/${created.getDate()} ${created.getHours()}:${created.getMinutes().toString().padStart(2,'0')}` : '';
      return `
        <div class="status-block" data-status="1">
          <h3>1. 已收送修　👤 ${user}　🕒 ${timeStr}</h3>
        </div>
      `;
    }

    const history = d.history?.[statusCode];
    const noteVal = d.notes?.[statusCode] || '';
    const user = history?.user || '';
    const timeStr = history?.time ? new Date(history.time).toLocaleString() : '';

    return `
      <div class="status-block" data-status="${statusCode}">
        ${!history ? `<button class="status-btn" data-next="${statusCode}">${title}</button>` 
                    : `<h3>${title}　👤 ${user}　🕒 ${timeStr}</h3>`}
        <textarea data-note="${statusCode}" placeholder="${placeholder || ''}">${noteVal}</textarea>
      </div>
    `;
  }

  const statusHTML = `
    ${renderStatusBlock(1, '1. 已收送修', '', '')}
    ${renderStatusBlock(2, '2. 已送廠商', '物流單號／寄送說明', '請輸入物流單號或寄送說明')}
    ${renderStatusBlock(3, '3. 維修完成', '維修說明', '請輸入處理狀況')}
    ${renderStatusBlock(31, '3-1. 廠商退回', '退回原因', '請輸入退回說明')}
    ${renderStatusBlock(4, '4. 客人已取回', '客戶回饋', '請填寫交貨說明或客戶回饋')}
  `;
