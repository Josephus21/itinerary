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

  currentRow.cells[0].textContent = so.so_upk || "";
  currentRow.cells[1].innerHTML = `<input type="text" value="" />`;

  for (let i = 2; i <= 7; i++) {
    currentRow.cells[i].textContent = "Loading...";
  }

  currentRow.cells[8].textContent = so.so_upk || "";
  currentRow.cells[9].innerHTML = `<input type="text" value="__________________________________" />`;
  currentRow.cells[10].innerHTML = `<button type="button" onclick="clearRow(this)">Clear</button>`;

  if (!so.so_pk) {
    console.error("Missing so_pk in selected sales order");
    for (let i = 2; i <= 7; i++) currentRow.cells[i].textContent = "N/A";
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
      for (let i = 2; i <= 7; i++) currentRow.cells[i].textContent = "N/A";
      closeModal();
      return;
    }

    currentRow.cells[2].textContent = transaction.ContractDescription_TransH || "";

    const deliveryDates = transaction.transaction_transactionledgerjobs
      ?.map(job => job.DeliveryDate_LdgrJob)
      .filter(Boolean)
      .join(', ') || "";
    currentRow.cells[3].textContent = deliveryDates;

    currentRow.cells[4].textContent = transaction.transaction_contactperson?.Name_ContactP || "";

    currentRow.cells[5].innerHTML = "";
    currentRow.cells[6].innerHTML = "";

    currentRow.cells[7].textContent = "";

  } catch (error) {
    console.error("Error fetching transaction details:", error);
    for (let i = 2; i <= 7; i++) currentRow.cells[i].textContent = "N/A";
  }

  closeModal();
}

// Print handler to print itinerary table
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
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 20px; margin-bottom: 20px; }
          .info { margin-bottom: 15px; font-size: 16px; }
          table, th, td {
            border: 1px solid black;
            border-collapse: collapse;
            padding: 8px;
            width: 100%;
            text-align: left;
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
