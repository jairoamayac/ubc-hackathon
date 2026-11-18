"use client";

import { useState } from "react";
import { RULES } from "@/lib/house-money/types";
import { Screen, usd } from "./ui";

const amounts = [100, 500, 1000];

export function DepositScreen({ name, onDeposit }: { name: string; onDeposit: (amount: number) => void }) {
  const [amount, setAmount] = useState(1000);
  const weekly = (amount * 0.05) / 52;

  return (
    <Screen>
      <p className="pt-2 text-sm font-bold text-muted">Hi {name}</p>
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">How much goes into your Vault?</h1>

      <p className="py-6 text-center text-6xl font-extrabold tracking-tight">{usd(amount)}</p>

      <div className="grid grid-cols-3 gap-3">
        {amounts.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            className="tile rounded-2xl py-3.5 text-lg font-extrabold"
            aria-pressed={amount === a}
          >
            ${a}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-stone px-5">
        <Row label="Your Vault pays you" value={`${usd(weekly)} / week`} />
        <Row label="Welcome house money" value={`+${usd(RULES.welcomeBonus)}`} accent />
      </div>
      <p className="text-sm font-semibold text-muted">House money is what you play with. Your savings never move.</p>

      <div className="flex-1" />
      <button onClick={() => onDeposit(amount)} className="btn btn-primary mb-6 w-full py-4 text-lg">
        Lock {usd(amount)} in my Vault
      </button>
    </Screen>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-4 font-bold">
      <span className="text-muted">{label}</span>
      <span className={accent ? "text-ember" : ""}>{value}</span>
    </div>
  );
}
