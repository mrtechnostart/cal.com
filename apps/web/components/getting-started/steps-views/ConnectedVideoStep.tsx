import { useRouter } from "next/navigation";

import { DEFAULT_SCHEDULE } from "@calcom/lib/availability";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { trpc } from "@calcom/trpc/react";
import type { TRPCClientErrorLike } from "@calcom/trpc/react";
import type { AppRouter } from "@calcom/trpc/server/routers/_app";
import { List, showToast } from "@calcom/ui";

import { AppConnectionItem } from "../components/AppConnectionItem";
import { StepConnectionLoader } from "../components/StepConnectionLoader";

const ConnectedVideoStep = () => {
  const { data: queryConnectedVideoApps, isPending } = trpc.viewer.integrations.useQuery({
    variant: "conferencing",
    onlyInstalled: false,
    sortByMostPopular: true,
  });
  // Filtering Apps
  const videoAppsNeeded = ["googlevideo", "zoomvideo", "webex", "office365video"];
  const filteredVideoApps = queryConnectedVideoApps?.items?.filter((el) => {
    if (videoAppsNeeded.includes(el.dirName || "")) return el;
  });
  const { t } = useLocale();

  // const hasAnyInstalledVideoApps = queryConnectedVideoApps?.items.some(
  //   (item) => item.userCredentialIds.length > 0
  // );

  // Code to make ConnectedVideoStep as Final Step
  const { data: eventTypes } = trpc.viewer.eventTypes.list.useQuery();
  const utils = trpc.useUtils();
  const router = useRouter();
  const createEventType = trpc.viewer.eventTypes.create.useMutation();
  const telemetry = useTelemetry();

  const DEFAULT_EVENT_TYPES = [
    {
      title: t("15min_meeting"),
      slug: "15min",
      length: 15,
    },
    {
      title: t("30min_meeting"),
      slug: "30min",
      length: 30,
    },
    {
      title: t("secret_meeting"),
      slug: "secret",
      length: 15,
      hidden: true,
    },
  ];

  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: async (_data) => {
      try {
        if (eventTypes?.length === 0) {
          await Promise.all(
            DEFAULT_EVENT_TYPES.map(async (event) => {
              return createEventType.mutate(event);
            })
          );
        }
      } catch (error) {
        console.error(error);
      }

      await utils.viewer.me.refetch();
      const redirectUrl = localStorage.getItem("onBoardingRedirect");
      localStorage.removeItem("onBoardingRedirect");

      showToast(t("your_user_profile_updated_successfully"), "success");
      redirectUrl ? router.push(redirectUrl) : router.push("/");
    },
    onError: () => {
      showToast(t("problem_saving_user_profile"), "error");
    },
  });
  function onSubmit() {
    telemetry.event(telemetryEventTypes.onboardingFinished);

    mutation.mutate({
      completedOnboarding: true,
    });
  }

  // Add Default Schedule Code To Final Step
  const mutationOptions = {
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      throw new Error(error.message);
    },
    onSuccess: () => {
      onSubmit();
    },
  };
  const createSchedule = trpc.viewer.availability.schedule.create.useMutation(mutationOptions);
  const defaultSchedule = {
    schedule: DEFAULT_SCHEDULE,
  };
  async function handleSubmit() {
    await createSchedule.mutate({
      name: t("default_schedule_name"),
      ...defaultSchedule,
    });
  }
  return (
    <>
      {!isPending && (
        <List className="bg-default  border-subtle divide-subtle scroll-bar mx-1 max-h-[45vh] divide-y !overflow-y-scroll rounded-md border p-0 sm:mx-0">
          {queryConnectedVideoApps?.items &&
            filteredVideoApps &&
            filteredVideoApps?.map((item) => {
              if (item.slug === "daily-video") return null; // we dont want to show daily here as it is installed by default
              return (
                <li key={item.name}>
                  {item.name && item.logo && (
                    <AppConnectionItem
                      type={item.type}
                      title={item.name}
                      description={item.description}
                      logo={item.logo}
                      installed={item.userCredentialIds.length > 0}
                    />
                  )}
                </li>
              );
            })}
        </List>
      )}

      {isPending && <StepConnectionLoader />}
      <button
        type="button"
        data-testid="save-video-button"
        className="text-inverted border-inverted bg-inverted mt-8 flex w-full flex-row justify-center rounded-md border p-2 text-center text-sm"
        // disabled={!hasAnyInstalledVideoApps}
        onClick={handleSubmit}>
        {t("finish")}
      </button>
    </>
  );
};

export { ConnectedVideoStep };
