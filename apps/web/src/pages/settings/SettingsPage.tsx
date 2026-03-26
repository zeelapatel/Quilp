import { useEffect, useMemo, useState } from "react";
import { Linkedin, Lock, Mic } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { DebugPanel } from "../../components/debug/DebugPanel";
import { CalibrationModal } from "../../components/voice/CalibrationModal";
import { VoiceProfileCard } from "../../components/voice/VoiceProfileCard";
import { useConnectLinkedIn, useDisconnectSocial, useSocialConnections } from "../../hooks/useSocialConnections";
import { useSettings, useUpdateSettings, type TimeoutAction } from "../../hooks/useSettings";
import { useAddAllowlistEntry, useRemoveAllowlistEntry, useSenderAllowlist } from "../../hooks/useSenderAllowlist";
import { useVoiceProfile } from "../../hooks/useVoiceProfile";
import type { AppOutletContext } from "../types";

const timezones = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Asia/Singapore"];

export function SettingsPage() {
  const { authUser, user, signOut } = useOutletContext<AppOutletContext>();
  const { settings } = useSettings();
  const { update } = useUpdateSettings();
  const { connections } = useSocialConnections();
  const { connect, isConnecting } = useConnectLinkedIn();
  const { disconnect, isDisconnecting } = useDisconnectSocial();

  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedApproval, setSavedApproval] = useState(false);
  const [savedFrequency, setSavedFrequency] = useState(false);
  const [savedQuiet, setSavedQuiet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [allowlistInput, setAllowlistInput] = useState("");
  const [allowlistError, setAllowlistError] = useState<string | null>(null);
  const { entries: allowlistEntries } = useSenderAllowlist();
  const { add: addAllowlistEntry, isAdding } = useAddAllowlistEntry();
  const { remove: removeAllowlistEntry } = useRemoveAllowlistEntry();
  const { profiles } = useVoiceProfile();
  const personalProfile = profiles.find(profile => profile.profileType === "personal") ?? null;
  const linkedInConnection = useMemo(
    () => connections.find(connection => connection.platform.toLowerCase().includes("linkedin") && connection.is_active) ?? null,
    [connections]
  );
  const approvalMode = settings?.approvalMode ?? "require_approval";
  const approvalTimeoutHrs = settings?.approvalTimeoutHrs ?? 4;
  const timeoutAction = (settings?.timeoutAction ?? "discard") as TimeoutAction;
  const maxPostsPerDay = settings?.maxPostsPerDay ?? 2;
  const quietEnabled = Boolean(settings?.blackoutStart && settings?.blackoutEnd);
  const blackoutStart = settings?.blackoutStart ?? "22:00";
  const blackoutEnd = settings?.blackoutEnd ?? "07:00";

  const [sliderValue, setSliderValue] = useState(maxPostsPerDay);

  useEffect(() => {
    setSliderValue(maxPostsPerDay);
  }, [maxPostsPerDay]);

  useEffect(() => {
    if (!settings?.timezone) {
      return;
    }
    setTimezone(settings.timezone);
  }, [settings?.timezone]);

  const showSaved = (setter: (value: boolean) => void) => {
    setter(true);
    window.setTimeout(() => setter(false), 1500);
  };

  const updateWithSaved = async (payload: Record<string, unknown>, setter: (value: boolean) => void) => {
    await update(payload);
    showSaved(setter);
  };

  return (
    <AppShell title="Settings" user={user} authEmail={authUser?.email ?? ""} onSignOut={signOut}>
      <section className="rounded border border-border bg-bg-secondary p-5">
        <h3 className="font-mono text-lg">Profile</h3>
        <div className="mt-4 grid gap-4">
          <div>
            <p className="text-xs text-text-secondary">Email</p>
            <p>{authUser?.email}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Timezone</p>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className="mt-1 h-10 rounded border border-border bg-bg-tertiary px-3 text-sm">
              {timezones.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void updateWithSaved({ timezone }, setSavedProfile)}
              className="active-button rounded border border-border px-3 py-1.5 text-xs hover:border-border-hover"
            >
              Save
            </button>
            {savedProfile ? <span className="text-xs text-success">Saved</span> : null}
          </div>
        </div>
      </section>

      <section id="voice" className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <h3 className="font-mono text-lg">Voice profile</h3>
        {personalProfile ? (
          <div className="mt-4">
            <VoiceProfileCard profile={personalProfile} onRecalibrate={() => setShowCalibrationModal(true)} />
          </div>
        ) : (
          <div className="mt-4 rounded border border-dashed border-[#333333] bg-bg-secondary p-6 text-center">
            <Mic size={20} className="mx-auto text-text-tertiary" />
            <p className="mt-2 text-sm text-text-secondary">No voice profile yet</p>
            <p className="mt-1 text-sm text-text-secondary">
              Add sample posts to train Quilp to write in your style
            </p>
            <button
              type="button"
              className="mt-3 rounded border border-border px-3 py-1.5 text-sm hover:border-border-hover"
              onClick={() => setShowCalibrationModal(true)}
            >
              Calibrate voice →
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-mono text-lg">Approval settings</h3>
          {savedApproval ? <span className="text-xs text-text-tertiary">Saved</span> : null}
        </div>
        <div className="rounded border border-border bg-bg-primary p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">Require approval before posting</p>
            <button
              type="button"
              onClick={() =>
                void updateWithSaved(
                  { approvalMode: approvalMode === "require_approval" ? "auto_post" : "require_approval" },
                  setSavedApproval
                )
              }
              className={`inline-flex h-[22px] w-10 items-center rounded-full p-0.5 transition-all duration-150 ${
                approvalMode === "require_approval" ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`h-[18px] w-[18px] rounded-full transition-transform duration-150 ${
                  approvalMode === "require_approval"
                    ? "translate-x-[18px] bg-bg-primary"
                    : "translate-x-0 bg-[#444444]"
                }`}
              />
            </button>
          </div>
          {approvalMode === "require_approval" ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span>If I don&apos;t respond in</span>
                <select
                  value={approvalTimeoutHrs}
                  className="h-9 rounded border border-border bg-bg-secondary px-3 font-mono text-[13px]"
                  onChange={event =>
                    void updateWithSaved({ approvalTimeoutHrs: Number(event.target.value) }, setSavedApproval)
                  }
                >
                  {[1, 2, 4, 8, 24].map(hours => (
                    <option key={hours} value={hours}>
                      {hours} hour{hours > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>Then:</span>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={timeoutAction === "auto_post"}
                    onChange={() => void updateWithSaved({ timeoutAction: "auto_post" }, setSavedApproval)}
                  />
                  Auto-schedule post
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={timeoutAction === "discard"}
                    onChange={() => void updateWithSaved({ timeoutAction: "discard" }, setSavedApproval)}
                  />
                  Discard post
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-mono text-lg">Frequency caps</h3>
          {savedFrequency ? <span className="text-xs text-text-tertiary">Saved</span> : null}
        </div>
        <div>
          <p className="text-sm">Maximum posts per day</p>
          <p className="mt-1 font-mono text-[28px] text-accent">{sliderValue}</p>
          <input
            type="range"
            min={1}
            max={10}
            value={sliderValue}
            onChange={event => setSliderValue(Number(event.target.value))}
            onMouseUp={event =>
              void updateWithSaved({ maxPostsPerDay: Number(event.currentTarget.value) }, setSavedFrequency)
            }
            onTouchEnd={event =>
              void updateWithSaved({ maxPostsPerDay: Number(event.currentTarget.value) }, setSavedFrequency)
            }
            className="mt-2 w-full"
          />
          <p className="mt-1 text-xs text-text-secondary">Per platform, per day</p>
        </div>
      </section>

      <section className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-mono text-lg">Quiet hours</h3>
          {savedQuiet ? <span className="text-xs text-text-tertiary">Saved</span> : null}
        </div>
        <div className="rounded border border-border bg-bg-primary p-3">
          <label className="flex items-center justify-between text-sm">
            Enable quiet hours
            <input
              type="checkbox"
              checked={quietEnabled}
              onChange={event =>
                void updateWithSaved(
                  event.target.checked
                    ? { blackoutStart, blackoutEnd }
                    : { blackoutStart: null, blackoutEnd: null },
                  setSavedQuiet
                )
              }
              className="h-4 w-4 accent-accent"
            />
          </label>
          {quietEnabled ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-text-secondary">From</p>
                <input
                  type="time"
                  value={blackoutStart}
                  onChange={event => void update({ blackoutStart: event.target.value })}
                  onBlur={event => void updateWithSaved({ blackoutStart: event.target.value }, setSavedQuiet)}
                  className="h-10 w-full rounded border border-border bg-bg-secondary px-3 font-mono text-sm"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-text-secondary">To</p>
                <input
                  type="time"
                  value={blackoutEnd}
                  onChange={event => void update({ blackoutEnd: event.target.value })}
                  onBlur={event => void updateWithSaved({ blackoutEnd: event.target.value }, setSavedQuiet)}
                  className="h-10 w-full rounded border border-border bg-bg-secondary px-3 font-mono text-sm"
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <h3 className="font-mono text-lg">Sender allowlist</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Emails from these senders will always be parsed and queued for post generation, regardless of confidence score.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            type="email"
            placeholder="sender@example.com"
            value={allowlistInput}
            onChange={e => { setAllowlistInput(e.target.value); setAllowlistError(null); }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addAllowlistEntry({ email: allowlistInput })
                  .then(() => setAllowlistInput(""))
                  .catch(err => setAllowlistError(err instanceof Error ? err.message : "Failed to add"));
              }
            }}
            className="h-9 flex-1 rounded border border-border bg-bg-tertiary px-3 text-sm"
          />
          <button
            type="button"
            disabled={isAdding || !allowlistInput.trim()}
            onClick={() =>
              void addAllowlistEntry({ email: allowlistInput })
                .then(() => setAllowlistInput(""))
                .catch(err => setAllowlistError(err instanceof Error ? err.message : "Failed to add"))
            }
            className="rounded border border-accent px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-black disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {allowlistError ? <p className="mt-1 text-xs text-danger">{allowlistError}</p> : null}
        {allowlistEntries.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {allowlistEntries.map(entry => (
              <li key={entry.id} className="flex items-center justify-between rounded border border-border bg-bg-primary px-3 py-2 text-sm">
                <span className="font-mono text-xs">{entry.email}</span>
                <button
                  type="button"
                  onClick={() => void removeAllowlistEntry(entry.id)}
                  className="text-xs text-text-tertiary hover:text-danger"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-text-tertiary">No senders added yet</p>
        )}
      </section>

      <section className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <h3 className="font-mono text-lg">Social accounts</h3>
        <div className="mt-4 space-y-3">
          <div className="rounded border border-border bg-bg-primary p-3">
            {linkedInConnection ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 text-sm">
                    <Linkedin size={16} className="text-[#0077B5]" />
                    {linkedInConnection.account_name ?? "LinkedIn"}
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                  </p>
                  <p className="truncate text-xs text-text-secondary">{linkedInConnection.account_email ?? "No email provided"}</p>
                </div>
                {confirmDisconnectId === linkedInConnection.id ? (
                  <p className="text-xs text-text-secondary">
                    Sure?{" "}
                    <button
                      type="button"
                      className="text-danger"
                      disabled={isDisconnecting}
                      onClick={() => {
                        setConfirmDisconnectId(null);
                        void disconnect(linkedInConnection.id);
                      }}
                    >
                      Disconnect
                    </button>{" "}
                    <button type="button" className="text-text-secondary" onClick={() => setConfirmDisconnectId(null)}>
                      Cancel
                    </button>
                  </p>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-text-secondary hover:text-danger"
                    onClick={() => setConfirmDisconnectId(linkedInConnection.id)}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm text-text-tertiary">
                  <Linkedin size={16} className="text-text-tertiary" />
                  Not connected
                </p>
                <button
                  type="button"
                  className="rounded border border-accent px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-black"
                  onClick={() => void connect()}
                  disabled={isConnecting}
                >
                  + Connect LinkedIn
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded border border-border bg-bg-primary p-3">
            <p className="inline-flex items-center gap-2 text-sm text-text-tertiary">
              <Lock size={14} />
              X / Twitter
            </p>
            <span className="text-xs text-text-tertiary">Coming in Sprint 5</span>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded border border-danger bg-bg-secondary p-5">
        <h3 className="font-mono text-lg text-danger">Danger zone</h3>
        <button type="button" onClick={() => setConfirmDelete(true)} className="mt-3 text-sm text-danger">
          Delete account
        </button>
        {confirmDelete ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-text-secondary">This will delete all your data. Type DELETE to confirm</p>
            <input value={deleteText} onChange={e => setDeleteText(e.target.value)} className="h-10 w-full rounded border border-border bg-bg-tertiary px-3 text-sm" />
            {deleteText === "DELETE" ? <p className="text-xs text-danger">Contact support to delete account</p> : null}
          </div>
        ) : null}
      </section>

      {import.meta.env.DEV ? <DebugPanel /> : null}

      <CalibrationModal
        open={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        onSuccess={() => setShowCalibrationModal(false)}
      />
    </AppShell>
  );
}
