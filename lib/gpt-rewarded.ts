declare global {
  interface Window {
    googletag?: any;
  }
}

export type RewardedAdResult =
  | { status: "granted" }
  | { status: "closed" }
  | { status: "unavailable" }
  | { status: "error"; message: string };

let rewardedSlot: any = null;
let listenersRegistered = false;

export function requestRewardedAd(adUnitPath: string): Promise<RewardedAdResult> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.googletag) {
      resolve({ status: "unavailable" });
      return;
    }

    const googletag = window.googletag;
    googletag.cmd = googletag.cmd || [];

    googletag.cmd.push(() => {
      try {
        if (!listenersRegistered) {
          listenersRegistered = true;
        }

        let finished = false;

        const cleanup = () => {
          if (rewardedSlot) {
            googletag.destroySlots([rewardedSlot]);
            rewardedSlot = null;
          }
        };

        const safeResolve = (result: RewardedAdResult) => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve(result);
        };

        rewardedSlot = googletag.defineOutOfPageSlot(
          adUnitPath,
          googletag.enums.OutOfPageFormat.REWARDED
        );

        if (!rewardedSlot) {
          safeResolve({ status: "unavailable" });
          return;
        }

        rewardedSlot.addService(googletag.pubads());

        const onReady = (event: any) => {
          if (event.slot === rewardedSlot) {
            try {
              event.makeRewardedVisible();
            } catch {
              safeResolve({ status: "error", message: "광고 표시 실패" });
            }
          }
        };

        const onGranted = (event: any) => {
          if (event.slot === rewardedSlot) {
            safeResolve({ status: "granted" });
          }
        };

        const onClosed = (event: any) => {
          if (event.slot === rewardedSlot) {
            safeResolve({ status: "closed" });
          }
        };

        googletag.pubads().addEventListener("rewardedSlotReady", onReady);
        googletag.pubads().addEventListener("rewardedSlotGranted", onGranted);
        googletag.pubads().addEventListener("rewardedSlotClosed", onClosed);

        googletag.enableServices();
        googletag.display(rewardedSlot);

        setTimeout(() => {
          safeResolve({ status: "unavailable" });
        }, 5000);
      } catch (error) {
        resolve({
          status: "error",
          message: error instanceof Error ? error.message : "unknown error",
        });
      }
    });
  });
}
