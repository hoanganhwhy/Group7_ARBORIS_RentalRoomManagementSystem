import { useEffect, useMemo, useState } from 'react';
import {
  PiBankLight,
  PiCheckCircleLight,
  PiWarningCircleLight,
  PiXLight,
} from 'react-icons/pi';
import { getBankTransactions } from '../lib/api';
import type { BankTransaction } from '../types';

const STORAGE_KEY = 'hostelmate:last-sepay-transaction-id';
const POLL_INTERVAL_MS = 3000;

function transactionTime(transaction: BankTransaction) {
  const value = transaction.transaction_date || transaction.created_at;
  if (!value) return '';

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export function BankTransactionNotifier() {
  const [queue, setQueue] = useState<BankTransaction[]>([]);
  const activeTransaction = queue[0] || null;

  useEffect(() => {
    let cancelled = false;

    async function pollTransactions() {
      try {
        const transactions = await getBankTransactions(20);
        if (cancelled || transactions.length === 0) return;

        const newestId = transactions[0].id;
        const lastSeenId = window.localStorage.getItem(STORAGE_KEY);

        // Lần đầu mở ứng dụng: ghi nhận giao dịch mới nhất nhưng không hiện lại
        // toàn bộ lịch sử cũ thành thông báo nổi.
        if (!lastSeenId) {
          window.localStorage.setItem(STORAGE_KEY, newestId);
          return;
        }

        const lastSeenIndex = transactions.findIndex((item) => item.id === lastSeenId);

        // Nếu giao dịch cũ đã nằm ngoài giới hạn 20 bản ghi, đồng bộ mốc mới
        // để tránh hiển thị nhầm một loạt thông báo đã cũ.
        if (lastSeenIndex === -1) {
          window.localStorage.setItem(STORAGE_KEY, newestId);
          return;
        }

        const newTransactions = transactions.slice(0, lastSeenIndex).reverse();
        if (newTransactions.length === 0) return;

        window.localStorage.setItem(STORAGE_KEY, newestId);
        setQueue((current) => [...current, ...newTransactions]);

        for (const transaction of newTransactions) {
          window.dispatchEvent(
            new CustomEvent<BankTransaction>('bank-transaction-received', {
              detail: transaction,
            }),
          );
        }
      } catch {
        // Backend có thể chưa chạy khi frontend vừa mở. Bộ kiểm tra sẽ thử lại
        // ở chu kỳ sau mà không làm gián đoạn các màn hình khác.
      }
    }

    pollTransactions();
    const intervalId = window.setInterval(pollTransactions, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!activeTransaction) return undefined;

    const timeoutId = window.setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, 6500);

    return () => window.clearTimeout(timeoutId);
  }, [activeTransaction]);

  const presentation = useMemo(() => {
    if (!activeTransaction) return null;

    const isIncoming = activeTransaction.transfer_type === 'in';
    const matchedInvoice = Boolean(activeTransaction.invoice_id);

    return {
      isIncoming,
      title: isIncoming
        ? matchedInvoice
          ? 'Đã nhận tiền và khớp hóa đơn'
          : 'MB Bank có tiền vào'
        : 'MB Bank có tiền ra',
      amount: `${isIncoming ? '+' : '-'}${activeTransaction.amount.toLocaleString('vi-VN')}đ`,
      subtitle: activeTransaction.content || 'Không có nội dung giao dịch',
      time: transactionTime(activeTransaction),
    };
  }, [activeTransaction]);

  if (!activeTransaction || !presentation) return null;

  return (
    <aside
      className={`fixed top-6 right-6 z-[200] w-[390px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-white p-5 shadow-2xl ${
        presentation.isIncoming ? 'border-sage-200' : 'border-rose-200'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            presentation.isIncoming ? 'bg-sage-50 text-sage-600' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {presentation.isIncoming ? (
            <PiCheckCircleLight className="h-6 w-6" />
          ) : (
            <PiWarningCircleLight className="h-6 w-6" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-charcoal-900">{presentation.title}</p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  presentation.isIncoming ? 'text-sage-600' : 'text-rose-600'
                }`}
              >
                {presentation.amount}
              </p>
            </div>

            <button
              type="button"
              aria-label="Đóng thông báo"
              className="rounded-lg p-1.5 text-charcoal-400 transition-colors hover:bg-charcoal-50 hover:text-charcoal-700"
              onClick={() => setQueue((current) => current.slice(1))}
            >
              <PiXLight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 rounded-xl bg-charcoal-50 px-3 py-2.5">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-charcoal-400">
              <PiBankLight className="h-4 w-4" /> MB Bank · SePay
            </p>
            <p className="mt-1 truncate text-sm text-charcoal-700" title={presentation.subtitle}>
              {presentation.subtitle}
            </p>
            {presentation.time && <p className="mt-1 text-xs text-charcoal-400">{presentation.time}</p>}
          </div>
        </div>
      </div>
    </aside>
  );
}
