
const modal = document.getElementById("soModal");
const soList = document.getElementById("soList");
const searchInput = document.getElementById("searchInput");
const dataTable = document.getElementById("dataTable").querySelector("tbody");

let currentRow = null;
let salesOrderCache = null;

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://itinerary-keqh.onrender.com';

function attachClickEvents() {
  document.querySelectorAll("td.clickable").forEach(cell => {
    cell.removeEventListener("click", onCellClick);
    cell.addEventListener("click", onCellClick);
  });
}

function onCellClick() {
  currentRow = this.parentElement;
  openModal();
}

function addRow() {
  const row = dataTable.insertRow();
  row.innerHTML = `
    <td class="clickable">Click to select</td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
  <td></td>
    <td>
      <button type="button" onclick="deleteRow(this)">Delete</button>
    </td>
  `;
  attachClickEvents();
}

function clearRow(button) {
  const row = button.closest("tr");
  if (!row) return;
  for (let i = 0; i < 10; i++) {
    row.cells[i].textContent = i === 0 ? "Click to select" : "";
  }
}

function deleteRow(button) {
  const row = button.closest("tr");
  if (!row) return;

  const blockId = row.dataset.blockId;

  if (!blockId) {
    row.remove();
    return;
  }

  const tbody = row.parentElement;
  const blockRows = Array.from(tbody.querySelectorAll(`tr[data-block-id="${blockId}"]`));
  const index = blockRows.indexOf(row);

  if (blockRows.length === 1) {
    if (!confirm("This is the only row for this SO. Delete anyway?")) return;
    row.remove();
    return;
  }

  if (index === 0) {
    row.cells[2].textContent = "";
    row.cells[4].textContent = "";
    for (let i = 1; i < blockRows.length - 1; i++) {
      blockRows[i].cells[2].textContent = blockRows[i + 1].cells[2].textContent;
      blockRows[i].cells[4].textContent = blockRows[i + 1].cells[4].textContent;
    }
    blockRows[blockRows.length - 1].remove();
  } else {
    for (let i = index; i < blockRows.length - 1; i++) {
      blockRows[i].cells[2].textContent = blockRows[i + 1].cells[2].textContent;
      blockRows[i].cells[4].textContent = blockRows[i + 1].cells[4].textContent;
    }
    blockRows[blockRows.length - 1].remove();
  }
}

function openModal() {
  modal.style.display = "block";
  searchInput.value = "";
  if (salesOrderCache) {
    renderSOList(salesOrderCache);
  } else {
    fetchSOs();
  }
}

function closeModal() {
  modal.style.display = "none";
}

searchInput.addEventListener("input", () => {
  if (!salesOrderCache) return;
  const query = searchInput.value.toLowerCase();
  const filtered = salesOrderCache.filter(so =>
    (so.so_upk || "").toLowerCase().includes(query)
  );
  renderSOList(filtered);
});

function showLoadingIndicator(text = "Loading...") {
  soList.innerHTML = `
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>${text}</span>
    </div>
  `;
}

function clearLoadingIndicator() {
  const indicator = soList.querySelector(".loading-indicator");
  if (indicator) indicator.remove();
}

async function fetchSOs() {
  const today = new Date().toISOString().split('T')[0];

  showLoadingIndicator("Loading sales orders...");

  try {
    const response = await fetch(`${API_BASE_URL}/api/sales_orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empl_pk: "c3f05940-066b-11ee-98e7-b92ca15f504a",
        preparedBy: "Josephus Abatayo",
        viewAll: 1,
        searchKey: "",
        filterDate: {
          filter: "from to",
          date1: { hide: false, date: "2023-01-01" },
          date2: { hide: false, date: today },
        },
        locationPK: "00a18fc0-051d-11ea-8e35-aba492d8cb65",
        departmentPK: null,
        customerPK: null,
        salesRepPK: null,
        status: "",
        limit: 1000,
        offset: 0,
      }),
    });

    if (!response.ok) {
      soList.textContent = `Failed to load sales orders. Status: ${response.status}`;
      return;
    }

    const json = await response.json();

    if (json.success && Array.isArray(json.data[0])) {
      salesOrderCache = json.data[0];
      clearLoadingIndicator();

      const batchSize = 10;
      for (let i = 0; i < salesOrderCache.length; i += batchSize) {
        const batch = salesOrderCache.slice(i, i + batchSize);
        renderSOList(batch, true);
        await new Promise((r) => setTimeout(r, 100));
      }
    } else {
      soList.textContent = "No sales orders found or invalid data format.";
    }
  } catch (error) {
    console.error("Fetch error:", error);
    soList.textContent = "Failed to load sales orders.";
  }
}

function renderSOList(salesOrders) {
  soList.innerHTML = "";
  if (salesOrders.length === 0) {
    soList.textContent = "No matching sales orders.";
    return;
  }
  salesOrders.forEach(so => {
    const div = document.createElement("div");
    div.className = "so-item";
    div.textContent = `${so.so_upk} - ${so.Name_Cust}`;
    div.addEventListener("click", () => selectSO(so));
    soList.appendChild(div);
  });
}

async function selectSO(so) {
  if (!currentRow) return;

  const parentTbody = currentRow.parentElement;
  const originalRowIndex = currentRow.sectionRowIndex;
  const blockId = `block-${so.so_pk || Date.now()}`;

  currentRow.remove();
  currentRow = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/get_transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ so_pk: so.so_pk }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const json = await response.json();
    const trx = json.data?.[0];
    const jobs = trx?.transaction_transactionledgerjobs || [];
    const maxLen = Math.max(jobs.length, 1);

    for (let i = 0; i < maxLen; i++) {
      const job = jobs[i] || {};
      const row = parentTbody.insertRow(originalRowIndex + i);
      row.dataset.blockId = blockId;

      row.innerHTML = `
        <td class="clickable">${i === 0 ? (so.so_upk || "") : ""}</td>
        <td></td>
        <td title="${job.Description_LdgrJob || ""}" style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${job.Description_LdgrJob || ""}
        </td>

        <td title="${i === 0 ? (trx.transaction_customer?.Address_Cust || "") : ""}" style="max-width: 400px; overflow: hidden; text-overflow: ellipsis;">
       ${i === 0 ? (trx.transaction_customer?.Address_Cust || "") : ""}
        </td>
      
      
        <td>                           </td>
        <td>${i === 0 ? (trx.transaction_contactperson?.Name_ContactP || "") : ""}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td>_______________________</td>
        
       <td class="space-x-1">
        <button type="button" onclick="deleteRow(this)" class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
 
  ${i === 0 ? `<button type="button" onclick="deleteBlock(this)" class="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700">Delete SO</button>` : ""}
</td>
      `;

      attachClickEvents();
    }
  } catch (error) {
    console.error("Error fetching transaction details:", error);
  }

  closeModal();
}

function deleteBlock(button) {
  const row = button.closest("tr");
  if (!row) return;

  const blockId = row.dataset.blockId;
  if (!blockId) {
    row.remove();
    return;
  }

  const rowsToDelete = Array.from(row.parentElement.querySelectorAll(`tr[data-block-id="${blockId}"]`));
  rowsToDelete.forEach(r => r.remove());
}
async function printPOSFormat() {
  const printWindow = window.open('', '', 'width=900,height=700');
  if (!printWindow) {
    alert("Popup blocked. Please allow popups for this site.");
    return;
  }

  const posItemsDiv = document.getElementById("posItems");
  posItemsDiv.innerHTML = "";

  const transactionDate = new Date().toLocaleDateString();
  const transactionNumber = `TRX-${Date.now()}`;

  const usedSOUPKs = new Set();
  const itineraryRows = document.querySelectorAll("#dataTable tbody tr");
  itineraryRows.forEach(row => {
    const soUpk = row.cells[0]?.textContent?.trim();
    if (soUpk) usedSOUPKs.add(soUpk);
  });

  if (!salesOrderCache || salesOrderCache.length === 0) {
    alert("No sales orders loaded. Open the modal first.");
    return;
  }

  const matchedSOs = salesOrderCache.filter(so => usedSOUPKs.has(so.so_upk));

  for (const so of matchedSOs) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/get_transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ so_pk: so.so_pk }),
      });

      if (!res.ok) continue;

      const json = await res.json();
      const trx = json.data?.[0];
      const jobs = trx?.transaction_transactionledgerjobs || [];
      const customerName = trx?.transaction_customer?.Name_Cust || 'N/A';
      const shipTo = trx?.transaction_customer?.Address_Cust || 'No Ship Address';

      for (const job of jobs) {
        const joNo = job.transactionledgerjob_transactionjo?.UserPK_TransH || 'No JO';
        const description = job.Description_LdgrJob || 'No Description';

        const itemDiv = document.createElement("div");
itemDiv.style.marginBottom = "30px";
itemDiv.style.whiteSpace = "pre-wrap";
itemDiv.style.pageBreakAfter = "always"; // <- Add this line
itemDiv.classList.add("jo-block");
        itemDiv.innerHTML = `
<div style="text-align: center;">
  <img src="logo.jpg" alt="Logo" style="max-width: 100px; margin-bottom: 2px;" />
  <div style="margin-top: 0px; font-weight: bold;">Cebu Graphicstar Imaging Corp.</div>
</div>

<div><strong>Transaction #:</strong> ${transactionNumber}</div>
  <div><strong>Customer:</strong> ${customerName}</div>
  <div><strong>JO#:</strong> ${joNo}</div>
  <div><strong>Description:</strong> ${description}</div>
  <div><strong>Ship to:</strong> ${shipTo}</div>
  <hr style="border-top: dashed 1px #000; margin-top: 1px;">
`.trim();


        posItemsDiv.appendChild(itemDiv);
      }

    } catch (e) {
      console.error("POS fetch failed:", e);
    }
  }

  const printContents = document.getElementById("posPrintArea").innerHTML;
  printWindow.document.write(`
    <html>
    <head>
      <style>
        @media print {
          @page {
            size: 80mm auto; /* Ensure it's receipt width */
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: monospace;
            font-size: 10px;
          }
          .pos-receipt {
            width: 72mm;
            padding: 4mm;
            white-space: pre-wrap;
          }
        }
      </style>
    </head>
    <body>
      <div class="pos-receipt">
        ${printContents}
      </div>
    </body>
  </html>
`);
  
  printWindow.document.close();
printWindow.onload = () => {
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};




}

function printItinerary() {
  const header = "LOGISTIC ITINERARY";
  const dateLine = "Date: _________________________";
  const driverLine = "Driver's Name: _________________";

  const tableClone = document.getElementById("dataTable").cloneNode(true);
  tableClone.querySelectorAll("input").forEach(input => {
    const td = input.closest("td");
    if (td) {
      td.textContent = input.value || "";
    }
  });

  const theadRow = tableClone.querySelector("thead tr");
  if (theadRow) theadRow.removeChild(theadRow.lastElementChild);
  const rows = tableClone.querySelectorAll("tbody tr");
  rows.forEach(row => row.removeChild(row.lastElementChild));

  const printContent = `
    <html>
      <head>
        <title>Logistic Itinerary</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            font-size: 12px;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 20px;
          }
          .info {
            margin-bottom: 15px;
            font-size: 14px;
          }
          table, th, td {
            border: 1px solid black;
            border-collapse: collapse;
            padding: 6px;
            text-align: left;
            vertical-align: top;
          }
        </style>
      </head>
      <body>
        <h1>${header}</h1>
        <div class="info">
          <span>${dateLine}</span>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <span>${driverLine}</span>
        </div>
        ${tableClone.outerHTML}
      </body>
    </html>
  `;

  const printWindow = window.open('', '', 'width=900,height=700');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

attachClickEvents();

