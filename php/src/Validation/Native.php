<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Validation;

use WebSanity\FormSanity\Model\Control;
use WebSanity\FormSanity\Types\Verdict;

/** The native register, re-derived from the attributes a control carries. A server has no `ValidityState`, so each flag is worked out here and the verdict and the code are read from it. */
final class Native
{
	/** The flags in the order the vocabulary fixes, mapped to the code each one reports. The first flag set decides the code. */
	private const array CODES = [
		'valueMissing' => 'required',
		'badInput' => 'badinput',
		'typeMismatch' => 'type.native',
		'patternMismatch' => 'pattern',
		'tooShort' => 'minlength',
		'tooLong' => 'maxlength',
		'rangeUnderflow' => 'min',
		'rangeOverflow' => 'max',
		'stepMismatch' => 'step',
	];

	/** The flags no appended character can rescue. Any one of them makes the verdict `invalid`, whatever the code says. */
	private const array INVALID = ['badInput', 'tooLong', 'rangeOverflow', 'stepMismatch'];

	/** The controls that hold text, so `minlength`, `maxlength`, and `pattern` measure them. */
	private const array TEXT_LIKE = ['text', 'search', 'tel', 'url', 'email', 'password', 'textarea'];

	/** The step of each control type when it carries no `step`, in the unit its value converts to: days for a date, seconds for a time. */
	private const array DEFAULT_STEP = ['number' => 1.0, 'range' => 1.0, 'date' => 1.0, 'time' => 60.0, 'datetime-local' => 60.0];

	/** A delimiter no author writes inside a `pattern`, so the authored expression needs no escaping. */
	private const string PATTERN_DELIMITER = "\x01";

	/** HTML's valid floating-point number: an optional sign, digits, an optional fraction, and an optional exponent. */
	private const string NUMBER = '/^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$/';

	/** HTML's valid e-mail address, which accepts a bare host with no dot. */
	private const string EMAIL = '/^[A-Za-z0-9.!#$%&\'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/';

	/** The scheme of an absolute URL, which is what `type="url"` asks for. */
	private const string SCHEME = '/^[A-Za-z][A-Za-z0-9+\-.]*:/';

	/** An authored `pattern` as the expression that matches it: anchored at both ends, in Unicode mode, with `D` so the end anchor means the end of the string and not the line before a trailing newline. */
	public static function patternExpression(string $pattern): string
	{
		return self::PATTERN_DELIMITER . '^(?:' . $pattern . ')$' . self::PATTERN_DELIMITER . 'uD';
	}

	/**
	 * The native verdict of one single-valued control.
	 *
	 * @return array{verdict: Verdict, code: ?string, params: array}
	 */
	public static function check(Control $control, string $value): array
	{
		$flags = self::flags($control, $value);

		if ($flags === []) {
			return ['verdict' => Verdict::Valid, 'code' => null, 'params' => []];
		}

		$verdict = array_intersect(self::INVALID, array_keys($flags)) === [] ? Verdict::Incomplete : Verdict::Invalid;

		foreach (self::CODES as $flag => $code) {
			if (isset($flags[$flag])) {
				return ['verdict' => $verdict, 'code' => $code, 'params' => $flags[$flag]];
			}
		}

		return ['verdict' => $verdict, 'code' => null, 'params' => []];
	}

	/**
	 * Every flag the attributes raise for this value, each with the parameters its message reads.
	 *
	 * @return array<string, array>
	 */
	private static function flags(Control $control, string $value): array
	{
		$native = $control->native;

		// Emptiness belongs to `required` alone. No other native constraint speaks to an empty value.
		if ($value === '') {
			return isset($native['required']) ? ['valueMissing' => []] : [];
		}

		$type = $control->type;

		// A value the type cannot represent is measured by nothing else: there is no number to compare and no date to order.
		if (self::isBadInput($type, $value)) {
			return ['badInput' => []];
		}

		$flags = [];

		if (self::isTypeMismatch($type, $value, $control->multiple)) {
			$flags['typeMismatch'] = [];
		}

		if (in_array($type, self::TEXT_LIKE, true)) {
			$flags += self::textFlags($native, $value);
		}

		return $flags + self::boundFlags($native, $type, $value);
	}

	/**
	 * The flags that measure the characters of a text control.
	 *
	 * @param array<string, string> $native
	 * @return array<string, array>
	 */
	private static function textFlags(array $native, string $value): array
	{
		$flags = [];

		if (isset($native['pattern']) && preg_match(self::patternExpression($native['pattern']), $value) !== 1) {
			$flags['patternMismatch'] = [];
		}

		$units = self::units($value);

		if (isset($native['minlength']) && $units < (int) $native['minlength']) {
			$flags['tooShort'] = ['n' => (int) $native['minlength']];
		}

		if (isset($native['maxlength']) && $units > (int) $native['maxlength']) {
			$flags['tooLong'] = ['n' => (int) $native['maxlength']];
		}

		return $flags;
	}

	/**
	 * The flags that order the value of a numeric or chronological control against `min`, `max`, and `step`.
	 *
	 * @param array<string, string> $native
	 * @return array<string, array>
	 */
	private static function boundFlags(array $native, string $type, string $value): array
	{
		$number = self::toNumber($type, $value);

		if ($number === null) {
			return [];
		}

		$flags = [];
		$minimum = isset($native['min']) ? self::toNumber($type, $native['min']) : null;
		$maximum = isset($native['max']) ? self::toNumber($type, $native['max']) : null;

		// A time control whose `min` is past its `max` describes the window that wraps midnight. A value outside that window is under the one bound and over the other at once, so the code is `min` and the verdict is `invalid`.
		if ($type === 'time' && $minimum !== null && $maximum !== null && $minimum > $maximum) {
			if ($number < $minimum && $number > $maximum) {
				$flags['rangeUnderflow'] = ['n' => $native['min']];
				$flags['rangeOverflow'] = ['n' => $native['max']];
			}
		} else {
			if ($minimum !== null && $number < $minimum) {
				$flags['rangeUnderflow'] = ['n' => $native['min']];
			}

			if ($maximum !== null && $number > $maximum) {
				$flags['rangeOverflow'] = ['n' => $native['max']];
			}
		}

		if (self::isStepMismatch($native, $type, $number, $minimum)) {
			$flags['stepMismatch'] = [];
		}

		return $flags;
	}

	/**
	 * A step measures divisibility from a base: `min` when it is present, and zero — the epoch for a date or a time — otherwise.
	 *
	 * @param array<string, string> $native
	 */
	private static function isStepMismatch(array $native, string $type, float $number, ?float $minimum): bool
	{
		$step = $native['step'] ?? null;

		if (is_string($step) && strtolower(trim($step)) === 'any') {
			return false;
		}

		$size = $step !== null && preg_match(self::NUMBER, $step) === 1 && (float) $step > 0 ? (float) $step : (self::DEFAULT_STEP[$type] ?? null);

		if ($size === null) {
			return false;
		}

		$quotient = ($number - ($minimum ?? 0.0)) / $size;

		// Binary floating point cannot hold every decimal step exactly, so a quotient counts as whole within a relative tolerance.
		return abs($quotient - round($quotient)) > 1e-9 * max(1.0, abs($quotient));
	}

	/** A value the control's type cannot represent at all. */
	private static function isBadInput(string $type, string $value): bool
	{
		return match ($type) {
			'number', 'range' => preg_match(self::NUMBER, $value) !== 1,
			'date' => self::toDate($value) === null,
			'time' => self::toTime($value) === null,
			'datetime-local' => self::toDateTime($value) === null,
			default => false,
		};
	}

	/** `type="email"` and `type="url"` are the two native types that report a mismatch rather than bad input. */
	private static function isTypeMismatch(string $type, string $value, bool $multiple): bool
	{
		if ($type === 'email') {
			// A `multiple` email control holds a comma-separated list, and every item of it must be an address.
			$items = $multiple ? array_map(trim(...), explode(',', $value)) : [$value];

			foreach ($items as $item) {
				if (preg_match(self::EMAIL, $item) !== 1) {
					return true;
				}
			}

			return false;
		}

		if ($type === 'url') {
			return preg_match('/\s/', $value) === 1 || preg_match(self::SCHEME, $value) !== 1 || parse_url($value) === false;
		}

		return false;
	}

	/** The value of the control as one number, so `min`, `max`, and `step` compare in the order its type defines. */
	private static function toNumber(string $type, string $value): ?float
	{
		return match ($type) {
			'number', 'range' => preg_match(self::NUMBER, $value) === 1 ? (float) $value : null,
			'date' => self::toDate($value),
			'time' => self::toTime($value),
			'datetime-local' => self::toDateTime($value),
			default => null,
		};
	}

	/** A calendar date as whole days from the epoch. */
	private static function toDate(string $value): ?float
	{
		if (preg_match('/^([0-9]{4,})-([0-9]{2})-([0-9]{2})$/', $value, $parts) !== 1) {
			return null;
		}

		[, $year, $month, $day] = array_map(intval(...), $parts);

		if (!checkdate($month, $day, $year)) {
			return null;
		}

		return gmmktime(0, 0, 0, $month, $day, $year) / 86400;
	}

	/** A wall-clock time as seconds from midnight. */
	private static function toTime(string $value): ?float
	{
		if (preg_match('/^([0-9]{2}):([0-9]{2})(?::([0-9]{2})(\.[0-9]{1,3})?)?$/', $value, $parts) !== 1) {
			return null;
		}

		$hours = (int) $parts[1];
		$minutes = (int) $parts[2];
		$seconds = (float) (($parts[3] ?? '0') . ($parts[4] ?? ''));

		if ($hours > 23 || $minutes > 59 || $seconds >= 60) {
			return null;
		}

		return $hours * 3600 + $minutes * 60 + $seconds;
	}

	/** A local date and time as seconds from the epoch, read with no time zone of its own. */
	private static function toDateTime(string $value): ?float
	{
		$halves = explode('T', $value);

		if (count($halves) !== 2) {
			return null;
		}

		$date = self::toDate($halves[0]);
		$time = self::toTime($halves[1]);

		return $date === null || $time === null ? null : $date * 86400 + $time;
	}

	/** HTML counts the length of a value in UTF-16 code units, so a character outside the basic plane counts as two. */
	private static function units(string $value): int
	{
		return intdiv(strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')), 2);
	}
}
