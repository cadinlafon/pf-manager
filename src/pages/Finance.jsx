import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, HandCoins, Landmark, Plus, Receipt, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { transactionStore } from "../firebase/store";
import { listPeople } from "../firebase/people";
import { downloadCsv, formatDay, formatMoney, formatSignedMoney, todayString } from "../lib/format";
import Modal from "../components/ui/Modal";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, TextField } from "../components/ui";

// Finance is a hand-kept ledger: every income and expense is entered by a
// leader. Nothing is imported from a bank. A tithe is an income entry in the
// "Tithe" category with the giver's name.
const CATEGORIES = {
  income: ["Offering", "Tithe", "Donation", "Fundraiser", "Other Income"],
  expense: ["Utilities", "Supplies", "Maintenance", "Ministry", "Payroll", "Missions", "Other Expense"],
};
const PAYMENT_METHODS = ["Cash", "Check", "Online", "Other"];
const SHOWN_AT_FIRST = 15;

export const signedAmount = (tx) => (tx.type === "income" ? tx.amount : -tx.amount);

function parseAmount(value) {
  const amount = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// Add and edit share one dialog; `transaction` is null when adding.
function TransactionModal({ transaction, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(
    transaction
      ? { type: transaction.type, date: transaction.date, description: transaction.description, category: transaction.category, amount: String(transaction.amount), notes: transaction.notes || "" }
      : { type: "expense", date: todayString(), description: "", category: CATEGORIES.expense[0], amount: "", notes: "" }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const setType = (type) => setForm((current) => ({ ...current, type, category: CATEGORIES[type][0] }));

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onSaved();
      onClose();
    } catch (err) {
      setError(firestoreMessage(err));
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = parseAmount(form.amount);
    if (!form.description.trim()) return setError("Add a description.");
    if (!amount) return setError("Enter an amount greater than zero.");
    if (!form.date) return setError("Choose a date.");
    const data = { type: form.type, date: form.date, description: form.description.trim(), category: form.category, amount, notes: form.notes.trim() };
    run(() => (transaction ? transactionStore.update(transaction.id, data) : transactionStore.create(data, { uid: user.uid })));
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${transaction.description}" (${formatMoney(transaction.amount)})? This can't be undone.`)) return;
    run(() => transactionStore.remove(transaction.id));
  };

  return (
    <Modal
      title={transaction ? "Edit Transaction" : "Add Transaction"}
      onClose={onClose}
      footer={
        <>
          {transaction && <Button variant="danger" icon={Trash2} onClick={handleDelete} disabled={busy} style={{ marginRight: "auto" }}>Delete</Button>}
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="tx-form" variant="primary" loading={busy}>{transaction ? "Save" : "Add Transaction"}</Button>
        </>
      }
    >
      <form id="tx-form" className="form" onSubmit={handleSubmit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="segmented" role="group" aria-label="Type" style={{ alignSelf: "flex-start" }}>
          <button type="button" aria-pressed={form.type === "income"} onClick={() => setType("income")}>Income</button>
          <button type="button" aria-pressed={form.type === "expense"} onClick={() => setType("expense")}>Expense</button>
        </div>
        <TextField label="Description" id="tx-description" value={form.description} placeholder={form.type === "income" ? "e.g. Sunday offering" : "e.g. Electric bill"} onChange={set("description")} />
        <div className="form-row">
          <TextField label="Amount" id="tx-amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={set("amount")} />
          <TextField label="Date" id="tx-date" type="date" value={form.date} onChange={set("date")} />
        </div>
        <Field label="Category" id="tx-category">
          <select id="tx-category" className="input" value={form.category} onChange={set("category")}>
            {CATEGORIES[form.type].map((category) => <option key={category}>{category}</option>)}
          </select>
        </Field>
        <TextField label="Notes" id="tx-notes" as="textarea" placeholder="Optional" value={form.notes} onChange={set("notes")} />
      </form>
    </Modal>
  );
}

function TitheForm({ onSaved }) {
  const { user } = useAuth();
  const blank = () => ({ person: "", amount: "", date: todayString(), method: PAYMENT_METHODS[0], notes: "" });
  const [form, setForm] = useState(blank);
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  // Suggest names from the People directory; it's fine if that can't load.
  useEffect(() => {
    listPeople().then(setPeople).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseAmount(form.amount);
    const person = form.person.trim();
    if (!person) return setMessage({ tone: "error", text: "Enter who gave (or \"Anonymous\")." });
    if (!amount) return setMessage({ tone: "error", text: "Enter an amount greater than zero." });
    if (!form.date) return setMessage({ tone: "error", text: "Choose a date." });

    setBusy(true);
    setMessage(null);
    try {
      await transactionStore.create(
        { type: "income", category: "Tithe", description: `Tithe — ${person}`, personName: person, amount, date: form.date, method: form.method, notes: form.notes.trim() },
        { uid: user.uid }
      );
      setForm(blank());
      setMessage({ tone: "success", text: `Recorded ${formatMoney(amount)} from ${person}.` });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: firestoreMessage(err) });
    }
    setBusy(false);
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TextField label="Member" id="tithe-member" list="tithe-people" autoComplete="off" placeholder="Start typing a name" value={form.person} onChange={set("person")} />
      <datalist id="tithe-people">
        {people.map((person) => <option key={person.id} value={person.name} />)}
      </datalist>
      <div className="form-row">
        <TextField label="Amount" id="tithe-amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={set("amount")} />
        <TextField label="Date" id="tithe-date" type="date" value={form.date} onChange={set("date")} />
      </div>
      <Field label="Payment Method" id="tithe-method">
        <select id="tithe-method" className="input" value={form.method} onChange={set("method")}>
          {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
        </select>
      </Field>
      <TextField label="Notes" id="tithe-notes" as="textarea" placeholder="Optional" value={form.notes} onChange={set("notes")} />
      <Button type="submit" variant="primary" icon={HandCoins} loading={busy}>Record Tithe</Button>
    </form>
  );
}

export default function Finance() {
  const query = useQuery(transactionStore.list);
  const { hash } = useLocation();
  // `editing`: undefined = closed, null = adding, object = editing it.
  const [editing, setEditing] = useState(undefined);
  const [showAll, setShowAll] = useState(false);

  // Dashboard's "Record Tithe" quick action links to /finance#record-tithe.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  const transactions = useMemo(
    () => [...(query.data || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)),
    [query.data]
  );

  const summary = useMemo(() => {
    const month = todayString().slice(0, 7);
    const thisMonth = transactions.filter((tx) => tx.date.startsWith(month));
    const sum = (rows, type) => rows.filter((tx) => tx.type === type).reduce((total, tx) => total + tx.amount, 0);
    return {
      balance: transactions.reduce((total, tx) => total + signedAmount(tx), 0),
      income: sum(thisMonth, "income"),
      expenses: sum(thisMonth, "expense"),
    };
  }, [transactions]);

  const stats = [
    { label: "Current Balance", value: summary.balance, icon: Landmark, note: "All recorded income minus expenses" },
    { label: "This Month's Income", value: summary.income, icon: TrendingUp, note: "Recorded this month" },
    { label: "This Month's Expenses", value: summary.expenses, icon: TrendingDown, note: "Recorded this month" },
  ];

  const exportCsv = () =>
    downloadCsv("transactions.csv", [
      ["Date", "Type", "Category", "Description", "Amount", "Payment Method", "Notes"],
      ...transactions.map((tx) => [tx.date, tx.type, tx.category, tx.description, signedAmount(tx).toFixed(2), tx.method || "", tx.notes || ""]),
    ]);

  const shown = showAll ? transactions : transactions.slice(0, SHOWN_AT_FIRST);
  const ready = Boolean(query.data);

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Giving, income and expenses, recorded by hand."
        action={<Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>Add Transaction</Button>}
      />

      <div className="stack">
        <div className="grid cols-3">
          {stats.map(({ label, value, icon: Icon, note }) => (
            <section key={label} className="card stat">
              <div className="stat-label">
                <span>{label}</span>
                <Icon size={18} aria-hidden />
              </div>
              <div className="stat-value">{ready ? formatMoney(value) : "—"}</div>
              <div className="row-sub">{note}</div>
            </section>
          ))}
        </div>

        <div className="grid main-side">
          <Card
            title="Transactions"
            icon={Receipt}
            action={transactions.length > 0 && <Button icon={Download} onClick={exportCsv}>Export CSV</Button>}
          >
            {query.loading && !ready ? (
              <LoadingState rows={5} />
            ) : query.error ? (
              <ErrorState message={query.error} onRetry={query.reload} />
            ) : transactions.length === 0 ? (
              <EmptyState icon={Receipt} title="No transactions yet"
                message="Record a tithe, or add income and expenses. To start from your real balance, add an income entry for it." />
            ) : (
              <>
                <div className="table-scroll">
                  <table className="table tx-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((tx) => (
                        <tr key={tx.id} className="clickable" tabIndex={0} onClick={() => setEditing(tx)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setEditing(tx)}>
                          <td className="nowrap">{formatDay(tx.date)}</td>
                          <td>
                            {tx.description}
                            <div className="row-sub">{tx.category}{tx.method ? ` · ${tx.method}` : ""}</div>
                          </td>
                          <td className={`num ${tx.type === "income" ? "amount-in" : "amount-out"}`}>{formatSignedMoney(signedAmount(tx))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {transactions.length > SHOWN_AT_FIRST && (
                  <div style={{ marginTop: 8 }}>
                    <Button variant="ghost" onClick={() => setShowAll((value) => !value)}>
                      {showAll ? "Show fewer" : `Show all ${transactions.length}`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>

          <div id="record-tithe" style={{ scrollMarginTop: 80 }}>
            <Card title="Record a Tithe" icon={HandCoins}>
              <TitheForm onSaved={query.reload} />
            </Card>
          </div>
        </div>
      </div>

      {editing !== undefined && <TransactionModal transaction={editing} onClose={() => setEditing(undefined)} onSaved={query.reload} />}
    </>
  );
}
