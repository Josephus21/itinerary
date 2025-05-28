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
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td></td><td></td>
    <td>
      <button type="button" onclick="clearRow(this)">Clear</button>
      <button type="button" onclick="deleteRow(this)">Delete Row</button>
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

  // If no blockId, just remove row normally
  if (!blockId) {
    row.remove();
    return;
  }

  const tbody = row.parentElement;
  const blockRows = Array.from(tbody.querySelectorAll(`tr[data-block-id="${blockId}"]`));
  const index = blockRows.indexOf(row);

  // If only one row in block, confirm before deleting
  if (blockRows.length === 1) {
    if (!confirm("This is the only row for this SO. Delete anyway?")) return;
    row.remove();
    return;
  }

  if (index === 0) {
    // Deleting the first row (SO# row)
    // Clear description and delivery date cells in first row
    row.cells[2].textContent = "";
    row.cells[4].textContent = "";

    // Shift descriptions and delivery dates from rows below UP one row starting at i=1
    for (let i = 1; i < blockRows.length - 1; i++) {
      blockRows[i].cells[2].textContent = blockRows[i + 1].cells[2].textContent;
      blockRows[i].cells[4].textContent = blockRows[i + 1].cells[4].textContent;
    }

    // Remove last row, since data shifted up
    blockRows[blockRows.length - 1].remove();
  } else {
    // Deleting a subrow (not SO# row)
    // Shift descriptions and delivery dates UP from the deleted row index
    for (let i = index; i < blockRows.length - 1; i++) {
      blockRows[i].cells[2].textContent = blockRows[i + 1].cells[2].textContent;
      blockRows[i].cells[4].textContent = blockRows[i + 1].cells[4].textContent;
    }

    // Remove last row after shifting
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
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
          filter: "as of",
          date1: { hide: false, date: today },
          date2: { hide: true, date: today },
        },
        locationPK: "00a18fc0-051d-11ea-8e35-aba492d8cb65",
        departmentPK: null,
        customerPK: null,
        salesRepPK: null,
        status: "",
        limit: 300,
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

  if (!so.so_pk) {
    const blankRow = parentTbody.insertRow(originalRowIndex);
    blankRow.dataset.blockId = blockId;
    blankRow.innerHTML = `
      <td class="clickable">Click to select</td>
      <td></td><td>N/A</td><td></td><td>N/A</td><td></td><td></td><td></td>
      <td></td><td>${so.so_upk || ""}</td>
      <td><input type="text" value="__________________________________" /></td>
       <button type="button" onclick="clearRow(this)">Clear</button>
    <button type="button" onclick="deleteRow(this)">Delete Row</button>
    ${i === 0 ? `<button type="button" onclick="deleteBlock(this)">Delete SO</button>` : ""}
  </td>
`;
    attachClickEvents();
    closeModal();
    return;
  }

  try {
    const transactionResponse = await fetch(`${API_BASE_URL}/api/get_transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ so_pk: so.so_pk }),
    });

    if (!transactionResponse.ok) throw new Error(`HTTP error! status: ${transactionResponse.status}`);

    const transactionData = await transactionResponse.json();
    const transaction = transactionData.data?.[0];
    const jobs = transaction?.transaction_transactionledgerjobs || [];
    const maxLen = Math.max(jobs.length, 1);

    for (let i = 0; i < maxLen; i++) {
      const job = jobs[i] || {};
      const row = parentTbody.insertRow(originalRowIndex + i);
      row.dataset.blockId = blockId;

      row.innerHTML = `
        <td class="clickable">${i === 0 ? (so.so_upk || "") : ""}</td>
        <td>${i === 0 ? `<input type="text" value="" />` : ""}</td>
        <td title="${job.Description_LdgrJob || ""}" style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
  ${job.Description_LdgrJob || ""}
</td>

       
       
        <td>${i === 0 ? (transaction.transaction_customer?.Address_Cust || "") : ""}</td>
       
       
        <td>${job.DeliveryDate_LdgrJob || ""}</td>
        
        <td>${i === 0 ? (transaction.transaction_contactperson?.Name_ContactP || "") : ""}</td>
        
        
        <td></td><td></td><td></td>
        <td>${i === 0 ? (so.so_upk || "") : ""}</td>
        <td>${i === 0 ? `<input type="text" value="__________________________________" />` : ""}</td>
        <td>
          <button type="button" onclick="clearRow(this)">Clear</button>
          <button type="button" onclick="deleteRow(this)">Delete Row</button>
          ${i === 0 ? `<button type="button" onclick="deleteBlock(this)">Delete SO</button>` : ""}
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
            word-break: normal;
          }
          table td:nth-child(1),
          table th:nth-child(1) {
            width: 80px;
            white-space: nowrap;
            font-weight: bold;
          }
          table td:nth-child(3),
          table th:nth-child(3) {
            width: 400px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: showing;
            text-overflow: ellipsis;
            white-space: normal;
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
