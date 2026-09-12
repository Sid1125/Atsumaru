export type AuthStackParamList = {
  Login: undefined;
  EmailAuth: undefined;
};

export type OnboardingStackParamList = {
  AIChat: undefined;
  ProfileConfirm: undefined;
};

export type AppStackParamList = {
  Discover: undefined;
  Meetup: { eventId: string };
  /**
   * The group thread. `title` is passed from the already-cached event so the
   * header never flashes empty — the same trick `Dm.handle` uses — and is
   * optional because a deep link cannot supply it.
   */
  GroupChat: { eventId: string; title?: string };
  /** Post-meetup feedback, presented as a modal. */
  Feedback: { eventId: string };
  Connections: undefined;
  /** Shows the user's past (completed) meetups. */
  PastMeetups: undefined;
  /** `handle` is passed for the title so the thread does not flash an empty header. */
  Dm: { connectionId: string; handle?: string };
  CreateEvent: undefined;
  Profile: undefined;
};
