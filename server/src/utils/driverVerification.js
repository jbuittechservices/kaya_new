/** A driver can receive/accept orders only once all three onboarding steps are admin-approved. */
export function isDriverVerified(user) {
  const onboarding = user?.onboarding_json ? JSON.parse(user.onboarding_json) : {}
  return !!(onboarding.personalInfo && onboarding.documents && onboarding.guarantor)
}
