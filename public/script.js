const modal = document.getElementById("soModal");
const soList = document.getElementById("soList");
const searchInput = document.getElementById("searchInput");
const dataTable = document.getElementById("dataTable").querySelector("tbody");

let currentRow = null;
let salesOrderCache = null;

// Determine API base URL dynamically
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://itinerary-keqh.onrender.com';

// Attach click event listeners to all clickable cells
function attachClickEvents() {
  document.querySelectorAll("td.clickable").forEach(cell => {
    cell.removeEventListener("click", onCellClick);
    cell.addEventListener("click", onCellClick);
  });
}

// When a clickable cell is clicked, open modal and set current row
function onCellClick() {
  currentRow = this.parentElement;
  openModal();
}

// Add a new row to the data table
function addRow() {
  const row = dataTable.insertRow();
  row.innerHTML = `
    <td class="clickable">Click to select</td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td></td><td></td>
    <td><button type="button" onclick="clearRow(this)">Clear</button></td>
  `;
  attachClickEvents();
}

// Clear data in a specific row and reset the first cell text
function clearRow(button) {
  const row = button.closest("tr");
  if (!row) return;
  for (let i = 0; i < 10; i++) {
    row.cells[i].textContent = i === 0 ? "Click to select" : "";
  }
}

// Show modal and load sales orders (either cached or fetch new)
function openModal() {
  modal.style.display = "block";
  searchInput.value = "";
  if (salesOrderCache) {
    renderSOList(salesOrderCache);
  } else {
    fetchSOs();
  }
}

// Close the modal dialog
function closeModal() {
  modal.style.display = "none";
}

// Filter sales orders list as user types in search input
searchInput.addEventListener("input", () => {
  if (!salesOrderCache) return;
  const query = searchInput.value.toLowerCase();
  const filtered = salesOrderCache.filter(so =>
    (so.so_upk || "").toLowerCase().includes(query)
  );
  renderSOList(filtered);
});

// Fetch sales orders from the API
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

      // Progressive render in batches
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

// Render sales orders into the modal list
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

// Select a sales order and populate current row with its data
async function selectSO(so) {
  if (!currentRow) return;

  const parentTbody = currentRow.parentElement;
  const originalRowIndex = currentRow.sectionRowIndex; // FIX: use sectionRowIndex instead of rowIndex

  // Clear the current row before inserting multiple rows if needed
  currentRow.remove();
  currentRow = null;

  if (!so.so_pk) {
    console.error("Missing so_pk in selected sales order");
    // Insert a blank row to keep UI consistent
    const blankRow = parentTbody.insertRow(originalRowIndex);
    blankRow.innerHTML = `
      <td class="clickable">Click to select</td>
      <td></td><td>N/A</td><td></td><td>N/A</td><td></td><td></td><td></td>
      <td></td><td>${so.so_upk || ""}</td>
      <td><input type="text" value="__________________________________" /></td>
      <td><button type="button" onclick="clearRow(this)">Clear</button></td>
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

    if (!transactionResponse.ok)
      throw new Error(`HTTP error! status: ${transactionResponse.status}`);

    const transactionData = await transactionResponse.json();
    const transaction = transactionData.data?.[0];

    if (!transaction) {
      console.warn("Transaction data is empty");
      // Insert a blank row with N/A info
      const blankRow = parentTbody.insertRow(originalRowIndex);
      blankRow.innerHTML = `
        <td class="clickable">Click to select</td>
        <td></td><td>N/A</td><td></td><td>N/A</td><td></td><td></td><td></td>
        <td></td><td>${so.so_upk || ""}</td>
        <td><input type="text" value="__________________________________" /></td>
        <td><button type="button" onclick="clearRow(this)">Clear</button></td>
      `;
      attachClickEvents();
      closeModal();
      return;
    }

    // Extract item descriptions and delivery dates from all jobs
    const jobs = transaction.transaction_transactionledgerjobs || [];
    const maxLen = Math.max(jobs.length, 1);

    // Insert one row per job
    for (let i = 0; i < maxLen; i++) {
      const job = jobs[i] || {};

      const row = parentTbody.insertRow(originalRowIndex + i);

      row.innerHTML = `
        <td class="clickable">${i === 0 ? (so.so_upk || "") : ""}</td>
        <td>${i === 0 ? `<input type="text" value="" />` : ""}</td>
        <td>${job.Description_LdgrJob || ""}</td>
        <td>${i === 0 ? (transaction.transaction_customer?.Address_Cust || "") : ""}</td>
        <td>${job.DeliveryDate_LdgrJob || ""}</td>
        <td>${i === 0 ? (transaction.transaction_contactperson?.Name_ContactP || "") : ""}</td>
        <td></td>
        <td></td>
        <td></td>
        <td>${i === 0 ? (so.so_upk || "") : ""}</td>
        <td>${i === 0 ? `<input type="text" value="__________________________________" />` : ""}</td>
        <td>${i === 0 ? `<button type="button" onclick="clearRow(this)">Clear</button>` : ""}</td>
      `;

      // Attach click events to new rows
      attachClickEvents();
    }
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    // Insert a blank row with error info
    const errorRow = parentTbody.insertRow(originalRowIndex);
    errorRow.innerHTML = `
      <td class="clickable">Click to select</td>
      <td></td><td>N/A</td><td></td><td>N/A</td><td></td><td></td><td></td>
      <td></td><td>${so.so_upk || ""}</td>
      <td><input type="text" value="__________________________________" /></td>
      <td><button type="button" onclick="clearRow(this)">Clear</button></td>
    `;
    attachClickEvents();
  }

  closeModal();
}


// Print handler to print itinerary table
function printItinerary() {
  const header = "LOGISTIC ITINERARY";
  const dateLine = "Date: _________________________";
  const driverLine = "Driver's Name: _________________";

  // Clone the table so we don't mess with original on page
  const tableClone = document.getElementById("dataTable").cloneNode(true);

  // Replace all inputs with their values as text
  tableClone.querySelectorAll("input").forEach(input => {
    const td = input.closest("td");
    if (td) {
      td.textContent = input.value || "";
    }
  });

  // Remove last header and last cell in each row (buttons etc)
  const theadRow = tableClone.querySelector("thead tr");
  if (theadRow) theadRow.removeChild(theadRow.lastElementChild);
  const rows = tableClone.querySelectorAll("tbody tr");
  rows.forEach(row => row.removeChild(row.lastElementChild));

  // Create the print HTML with CSS for widths and clamp
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
            word-break: normal; /* prevent breaking mid word */
          }

          /* SO# column - first column narrow and no wrap */
          table td:nth-child(1),
          table th:nth-child(1) {
            width: 80px;
            white-space: nowrap;
            font-weight: bold;
          }

          /* Item Description column - third column wider with clamp to max 2 lines */
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

// Initial setup: attach click events on page load
attachClickEvents();
