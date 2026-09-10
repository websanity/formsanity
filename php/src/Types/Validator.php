<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Types;

use WebSanity\FormSanity\AuthoringError;

/** The `data-fs-type` catalog: the formats HTML cannot express, each answering with one of the three verdicts. */
final class Validator
{
	/** The pattern types. `full` matches a complete value; `prefix` matches a value that appended characters can still complete. */
	private const array PATTERNS = [
		'alpha' => ['full' => '/^[A-Za-z]+$/u', 'prefix' => '/^[A-Za-z]*$/u'],
		'alphanum' => ['full' => '/^[A-Za-z0-9]+$/u', 'prefix' => '/^[A-Za-z0-9]*$/u'],
		'identifier' => ['full' => '/^[A-Za-z0-9_-]+$/u', 'prefix' => '/^[A-Za-z0-9_-]*$/u'],
		'no-whitespace' => ['full' => '/^\S+$/u', 'prefix' => '/^\S*$/u'],
		'email' => ['full' => '/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', 'prefix' => '/^[^\s@]+(@[^\s@]*)?$/u'],
		'cvv' => ['full' => '/^\d{3,4}$/u', 'prefix' => '/^\d{0,4}$/u'],
		'ssn' => ['full' => '/^\d{3}[- ]?\d{2}[- ]?\d{4}$/u', 'prefix' => '/^\d{0,3}([- ]?\d{0,2}([- ]?\d{0,4})?)?$/u'],
		'duration' => ['full' => '/^(\d{1,4}|\d{1,3}:[0-5]?\d)$/u', 'prefix' => '/^(\d{0,4}|\d{1,3}:([0-5]\d?)?)$/u'],
		'us-dollar' => ['full' => '/^\$?(\d+|\d{1,3}(,\d{3})+)(\.\d{0,2})?$/u', 'prefix' => '/^\$?(\d+|\d{1,3}(,\d{0,3})*)?(\.\d{0,2})?$/u'],
		'zip' => ['full' => '/^\d{5}(-?\d{4})?$/u', 'prefix' => '/^\d{0,5}(-?\d{0,4})?$/u'],
	];

	/** The types defined by procedure rather than by a pattern. */
	private const array ALGORITHMIC = ['ipv4', 'ipv6', 'ip', 'email-list', 'credit-card', 'us-phone', 'international-phone'];

	/** The types that define an ordering of their own, so `data-fs-min` and `data-fs-max` can compare in it. */
	private const array ORDERED = ['duration', 'us-dollar'];

	/** The card networks: the issuer prefixes that make a network a candidate, and the digit counts it accepts. */
	private const array NETWORKS = [
		'Visa' => ['prefixes' => ['4'], 'lengths' => [13, 16, 19]],
		'MasterCard' => ['prefixes' => ['51', '52', '53', '54', '55', '22', '23', '24', '25', '26', '27'], 'lengths' => [16]],
		'Amex' => ['prefixes' => ['34', '37'], 'lengths' => [15]],
		'Discover' => ['prefixes' => ['6011', '65'], 'lengths' => [16, 17, 18, 19]],
	];

	/** The networks a `credit-card` field permits when it carries no `data-fs-type-param`. */
	private const string DEFAULT_NETWORKS = 'Visa|MasterCard|Amex|Discover';

	/** The shape a valid `us-phone` must be arranged in, once its digits count out to ten. */
	private const string US_PHONE_SHAPE = '/^(\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}$/u';

	/** The characters a phone number may hold, beyond an optional leading `+`. */
	private const string PHONE_CHARACTERS = '/[^0-9() .\-]/u';

	public static function isKnown(string $type): bool
	{
		return isset(self::PATTERNS[$type]) || in_array($type, self::ALGORITHMIC, true);
	}

	public static function isOrdered(string $type): bool
	{
		return in_array($type, self::ORDERED, true);
	}

	/** A type check never fires on an empty value. Emptiness belongs to `required`. */
	public static function check(string $type, string $value, ?string $param = null): Verdict
	{
		if (!self::isKnown($type)) {
			throw new AuthoringError(sprintf('Unknown data-fs-type "%s".', $type));
		}

		if ($value === '') {
			return Verdict::Valid;
		}

		if ($type === 'duration') {
			return self::duration($value);
		}

		if (isset(self::PATTERNS[$type])) {
			return self::pattern($type, $value);
		}

		return match ($type) {
			'ipv4' => self::ipv4($value),
			'ipv6' => self::ipv6($value),
			'ip' => self::ip($value),
			'email-list' => self::emailList($value),
			'credit-card' => self::creditCard($value, $param),
			'us-phone' => self::usPhone($value),
			'international-phone' => self::internationalPhone($value),
		};
	}

	/** A comparable number for an ordered type: elapsed minutes for `duration`, the amount for `us-dollar`. A value the type cannot parse has no place in the order. */
	public static function order(string $type, string $value): ?float
	{
		if (!self::isOrdered($type) || $value === '' || self::check($type, $value) !== Verdict::Valid) {
			return null;
		}

		return match ($type) {
			'duration' => self::minutes($value),
			'us-dollar' => (float) str_replace(['$', ','], '', $value),
		};
	}

	/** A value that matches `full` is valid. Otherwise, a value that matches `prefix` is incomplete. Otherwise, the value is invalid. */
	private static function pattern(string $type, string $value): Verdict
	{
		if (preg_match(self::PATTERNS[$type]['full'], $value) === 1) {
			return Verdict::Valid;
		}

		return preg_match(self::PATTERNS[$type]['prefix'], $value) === 1 ? Verdict::Incomplete : Verdict::Invalid;
	}

	/** A zero duration is no duration: a dead end once both minute digits are typed, and still on its way otherwise. */
	private static function duration(string $value): Verdict
	{
		$verdict = self::pattern('duration', $value);
		if ($verdict !== Verdict::Valid || self::minutes($value) > 0.0) {
			return $verdict;
		}

		return preg_match('/:\d\d$/u', $value) === 1 ? Verdict::Invalid : Verdict::Incomplete;
	}

	/** Elapsed minutes: a bare number is minutes, and `H:MM` is hours and minutes. */
	private static function minutes(string $value): float
	{
		if (!str_contains($value, ':')) {
			return (float) $value;
		}

		[$hours, $rest] = explode(':', $value, 2);

		return (float) $hours * 60.0 + (float) $rest;
	}

	private static function ipv4(string $value): Verdict
	{
		if (preg_match('/[^0-9.]/u', $value) === 1) {
			return Verdict::Invalid;
		}

		$parts = explode('.', $value);
		if (count($parts) > 4) {
			return Verdict::Invalid;
		}

		$last = count($parts) - 1;
		foreach ($parts as $index => $part) {
			if ($index < $last && $part === '') {
				return Verdict::Invalid;
			}

			if (strlen($part) > 3 || ($part !== '' && (int) $part > 255)) {
				return Verdict::Invalid;
			}
		}

		return count($parts) === 4 && $parts[3] !== '' ? Verdict::Valid : Verdict::Incomplete;
	}

	private static function ipv6(string $value): Verdict
	{
		if (preg_match('/[^0-9A-Fa-f:]/u', $value) === 1) {
			return Verdict::Invalid;
		}

		if (substr_count($value, '::') > 1) {
			return Verdict::Invalid;
		}

		$elides = str_contains($value, '::');
		$marked = $elides ? self::replaceFirst($value, '::', ':x:') : $value;
		$parts = array_filter(explode(':', $marked), static fn (string $part): bool => $part !== '');
		$groups = array_filter($parts, static fn (string $part): bool => $part !== 'x');

		foreach ($groups as $group) {
			if (strlen($group) > 4) {
				return Verdict::Invalid;
			}
		}

		if (count($groups) > 8) {
			return Verdict::Invalid;
		}

		$complete = $elides ? count($groups) <= 7 : count($groups) === 8;

		return $complete && !str_ends_with($value, ':') ? Verdict::Valid : Verdict::Incomplete;
	}

	private static function replaceFirst(string $subject, string $search, string $replacement): string
	{
		$at = strpos($subject, $search);

		return $at === false ? $subject : substr_replace($subject, $replacement, $at, strlen($search));
	}

	/** Either family will do, so the better of the two verdicts stands. */
	private static function ip(string $value): Verdict
	{
		$four = self::ipv4($value);
		$six = self::ipv6($value);

		return $six->worseThan($four) ? $four : $six;
	}

	/** An incomplete item that the author has moved past is finished and wrong, so only the last item may still be on its way. */
	private static function emailList(string $value): Verdict
	{
		$items = preg_split('/[\s,]+/u', $value, -1, PREG_SPLIT_NO_EMPTY);
		if ($items === false || $items === []) {
			return Verdict::Valid;
		}

		$last = count($items) - 1;
		$verdicts = [];
		foreach ($items as $index => $item) {
			$verdict = self::pattern('email', $item);
			$verdicts[] = $verdict === Verdict::Incomplete && $index !== $last ? Verdict::Invalid : $verdict;
		}

		return Verdict::worst(...$verdicts);
	}

	private static function creditCard(string $value, ?string $param): Verdict
	{
		$digits = str_replace([' ', '-'], '', $value);
		if (preg_match('/\D/u', $digits) === 1) {
			return Verdict::Invalid;
		}

		$permitted = [];
		foreach (explode('|', $param ?? self::DEFAULT_NETWORKS) as $name) {
			if (isset(self::NETWORKS[$name])) {
				$permitted[$name] = self::NETWORKS[$name];
			}
		}

		$count = strlen($digits);
		$candidates = $count < 2 ? $permitted : array_filter($permitted, static function (array $network) use ($digits): bool {
			foreach ($network['prefixes'] as $prefix) {
				if (str_starts_with($digits, $prefix)) {
					return true;
				}
			}

			return false;
		});

		if ($candidates === []) {
			return Verdict::Invalid;
		}

		$lengths = array_merge(...array_column($candidates, 'lengths'));
		if ($count > max($lengths)) {
			return Verdict::Invalid;
		}

		if (!in_array($count, $lengths, true)) {
			return Verdict::Incomplete;
		}

		return self::luhn($digits) ? Verdict::Valid : Verdict::Invalid;
	}

	/** Walk the digits from right to left, double every second one, subtract 9 from a doubled result above 9, and sum. The number passes when the sum is divisible by ten. */
	private static function luhn(string $digits): bool
	{
		$sum = 0;
		$double = false;
		for ($index = strlen($digits) - 1; $index >= 0; $index--) {
			$digit = (int) $digits[$index];
			if ($double) {
				$digit *= 2;
				if ($digit > 9) {
					$digit -= 9;
				}
			}

			$sum += $digit;
			$double = !$double;
		}

		return $sum % 10 === 0;
	}

	private static function usPhone(string $value): Verdict
	{
		$plus = str_starts_with($value, '+');
		$body = $plus ? substr($value, 1) : $value;
		if (preg_match(self::PHONE_CHARACTERS, $body) === 1) {
			return Verdict::Invalid;
		}

		$digits = self::digitsOf($body);
		if ($plus && $digits !== '' && $digits[0] !== '1') {
			return Verdict::Invalid;
		}

		$count = strlen($digits);
		if ($count === 11 && $digits[0] === '1') {
			$count = 10;
		} elseif ($count > 10) {
			return Verdict::Invalid;
		}

		return $count === 10 && preg_match(self::US_PHONE_SHAPE, $value) === 1 ? Verdict::Valid : Verdict::Incomplete;
	}

	private static function internationalPhone(string $value): Verdict
	{
		$body = str_starts_with($value, '+') ? substr($value, 1) : $value;
		if (preg_match(self::PHONE_CHARACTERS, $body) === 1) {
			return Verdict::Invalid;
		}

		$count = strlen(self::digitsOf($body));
		if ($count > 15) {
			return Verdict::Invalid;
		}

		return $count >= 7 ? Verdict::Valid : Verdict::Incomplete;
	}

	private static function digitsOf(string $value): string
	{
		return (string) preg_replace('/\D/u', '', $value);
	}
}
