<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Types;

/** One of the three states a check can return. */
enum Verdict: string
{
	case Valid = 'valid';
	case Incomplete = 'incomplete';
	case Invalid = 'invalid';

	/** Rank in the merge order: `invalid` is worse than `incomplete`, which is worse than `valid`. */
	private function rank(): int
	{
		return match ($this) {
			self::Valid => 0,
			self::Incomplete => 1,
			self::Invalid => 2,
		};
	}

	public function worseThan(Verdict $other): bool
	{
		return $this->rank() > $other->rank();
	}

	/** The verdict of a field is the worst verdict among every check that applies to it. */
	public static function worst(Verdict ...$verdicts): Verdict
	{
		$worst = self::Valid;
		foreach ($verdicts as $verdict) {
			if ($verdict->worseThan($worst)) {
				$worst = $verdict;
			}
		}

		return $worst;
	}
}
