export type AuthStackParamList = {
  Login: undefined;
};

export type OnboardingStackParamList = {
  AIChat: undefined;
  ProfileConfirm: undefined;
};

export type AppStackParamList = {
  Discover: undefined;
  Meetup: { eventId: string };
  Connections: undefined;
  /** `handle` is passed for the title so the thread does not flash an empty header. */
  Dm: { connectionId: string; handle?: string };
  CreateEvent: undefined;
  Settings: undefined;
};
