<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Validation;

use WebSanity\FormSanity\Expression\Compiled;
use WebSanity\FormSanity\Expression\Parser as ExpressionParser;
use WebSanity\FormSanity\Model\Field;
use WebSanity\FormSanity\Model\Form;
use WebSanity\FormSanity\Model\Rule;
use WebSanity\FormSanity\Payload\Upload;
use WebSanity\FormSanity\Types\Validator as TypeValidator;
use WebSanity\FormSanity\Types\Verdict;

/** The `data-fs-*` rules of a field, and the group rules that read several fields at once. A rule never fires on an empty value, apart from the requiredness codes and the groups. */
final class Rules
{
	/** The character class each password composition rule counts. */
	private const array COMPOSITION = ['min-digits' => '/[0-9]/', 'min-uppercase' => '/[A-Z]/', 'min-lowercase' => '/[a-z]/'];

	/** The binary multiple each unit of the size grammar names. */
	private const array UNITS = ['b' => 1, 'kb' => 1024, 'mb' => 1048576, 'gb' => 1073741824];

	/** The size grammar the markup parser proved well-formed, read here for the byte limit it names. */
	private const string SIZE = '/^([0-9]+(?:\.[0-9]+)?)\s*(b|kb|mb|gb)$/i';

	/** A time of day, with the hour of a bound allowed to omit its leading zero. */
	private const string TIME = '/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/';

	/** Every expression source the markup carries, compiled once and read back on each field pass. @var array<string, Compiled> */
	private static array $compiled = [];

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	public static function check(Rule $rule, Field $field, Relevance $relevance, Form $form): ?array
	{
		$value = $relevance->valueOf($field->name);

		return match ($rule->kind) {
			'constraint' => self::constraint($rule, $field, $relevance),
			'min-time', 'max-time' => self::dailyWindow($rule, $field, $value),
			'min-digits', 'min-uppercase', 'min-lowercase' => self::composition($rule, $value),
			'group-unique-values' => self::uniqueValues($rule, $field, $relevance, $form),
			'min-selected', 'max-selected' => self::selectionCount($rule, $value),
			'max-file-size' => self::maxFileSize($rule, $value),
			'accept' => self::accept($rule, $value),
			'min-value', 'max-value' => self::bound($rule, $field, $value),
			default => null,
		};
	}

	/**
	 * The verdict each group of the form puts on its members, keyed by field name.
	 *
	 * @return array<string, array{verdict: Verdict, code: string, params: array}>
	 */
	public static function groups(Form $form, Relevance $relevance): array
	{
		$failures = [];

		foreach ($form->groups as $group) {
			$members = array_values(array_filter($group->members, static fn (string $name): bool => $relevance->isFieldRelevant($name)));
			$answered = array_values(array_filter($members, static fn (string $name): bool => $relevance->get($name) !== ''));

			if ($group->kind === 'required-any') {
				// A required-any group that is entirely empty flags every member of it.
				if ($members !== [] && $answered === []) {
					foreach ($members as $name) {
						$failures[$name] = self::failure(Verdict::Incomplete, 'group.required-any');
					}
				}

				continue;
			}

			// A required-together group is satisfied when every member holds a value and when none does. Anything between flags each empty member.
			if ($answered === [] || count($answered) === count($members)) {
				continue;
			}

			foreach ($members as $name) {
				if ($relevance->get($name) === '') {
					$failures[$name] = self::failure(Verdict::Incomplete, 'group.required-together');
				}
			}
		}

		return $failures;
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function constraint(Rule $rule, Field $field, Relevance $relevance): ?array
	{
		$expression = self::$compiled[$rule->param] ??= ExpressionParser::parse($rule->param);

		// A constraint judges an answer, never its absence. Emptiness belongs to requiredness.
		if ($relevance->get($field->name) === '') {
			return null;
		}

		foreach ($expression->dependencies as $name) {
			if ($name === $field->name) {
				continue;
			}

			// A field is never flagged because a question it depends on has no answer yet, or holds one its own validation rejects.
			if ($relevance->get($name) === '' || !$relevance->valid($name)) {
				return null;
			}
		}

		return $expression->evaluate($relevance) ? null : self::failure(Verdict::Invalid, 'constraint');
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function dailyWindow(Rule $rule, Field $field, mixed $value): ?array
	{
		if (!is_string($value) || $value === '') {
			return null;
		}

		$time = self::timeOfDay($value);
		$bound = self::seconds($rule->param);

		if ($time === null || $bound === null) {
			return null;
		}

		$opposite = self::seconds(self::paramOf($field, $rule->kind === 'min-time' ? 'max-time' : 'min-time') ?? '');
		$minimum = $rule->kind === 'min-time' ? $bound : $opposite;
		$maximum = $rule->kind === 'min-time' ? $opposite : $bound;

		// A minimum past the maximum describes a window that wraps midnight. A value inside neither half is reported once for the pair, as `min-time`.
		if ($minimum !== null && $maximum !== null && $minimum > $maximum) {
			if ($rule->kind === 'max-time') {
				return null;
			}

			return $time >= $minimum || $time <= $maximum ? null : self::failure(Verdict::Incomplete, 'min-time', ['n' => trim($rule->param)]);
		}

		if ($rule->kind === 'min-time') {
			return $time < $bound ? self::failure(Verdict::Incomplete, 'min-time', ['n' => trim($rule->param)]) : null;
		}

		return $time > $bound ? self::failure(Verdict::Invalid, 'max-time', ['n' => trim($rule->param)]) : null;
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function composition(Rule $rule, mixed $value): ?array
	{
		if (!is_string($value) || $value === '') {
			return null;
		}

		$wanted = (int) trim($rule->param);

		return preg_match_all(self::COMPOSITION[$rule->kind], $value) >= $wanted ? null : self::failure(Verdict::Incomplete, $rule->kind, ['n' => $wanted]);
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function uniqueValues(Rule $rule, Field $field, Relevance $relevance, Form $form): ?array
	{
		$value = $relevance->get($field->name);

		// Empty values never collide.
		if ($value === '') {
			return null;
		}

		foreach ($form->fields as $name => $other) {
			$name = (string) $name;

			if ($name === $field->name || !$relevance->isFieldRelevant($name)) {
				continue;
			}

			foreach ($other->rules as $membership) {
				if ($membership->kind === 'group-unique-values' && $membership->param === $rule->param && $relevance->get($name) === $value) {
					return self::failure(Verdict::Invalid, 'group.unique-values');
				}
			}
		}

		return null;
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function selectionCount(Rule $rule, mixed $value): ?array
	{
		$wanted = (int) trim($rule->param);
		$count = is_array($value) ? count($value) : ($value === '' ? 0 : 1);

		if ($rule->kind === 'min-selected') {
			return $count < $wanted ? self::failure(Verdict::Incomplete, 'min-selected', ['n' => $wanted]) : null;
		}

		return $count > $wanted ? self::failure(Verdict::Invalid, 'max-selected', ['n' => $wanted]) : null;
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function maxFileSize(Rule $rule, mixed $value): ?array
	{
		$size = trim($rule->param);
		$limit = self::bytes($size);

		if ($limit === null || !is_array($value)) {
			return null;
		}

		foreach ($value as $upload) {
			if ($upload instanceof Upload && $upload->size > $limit) {
				return self::failure(Verdict::Invalid, 'file.max-size', ['n' => $size]);
			}
		}

		return null;
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function accept(Rule $rule, mixed $value): ?array
	{
		$tokens = array_values(array_filter(array_map(trim(...), explode(',', $rule->param)), static fn (string $token): bool => $token !== ''));

		if ($tokens === [] || !is_array($value)) {
			return null;
		}

		foreach ($value as $upload) {
			if ($upload instanceof Upload && !self::admits($tokens, $upload)) {
				return self::failure(Verdict::Invalid, 'file.accept');
			}
		}

		return null;
	}

	/** @param list<string> $tokens */
	private static function admits(array $tokens, Upload $upload): bool
	{
		foreach ($tokens as $token) {
			if (str_starts_with($token, '.')) {
				if (str_ends_with(strtolower($upload->name), strtolower($token))) {
					return true;
				}

				continue;
			}

			if (str_ends_with($token, '/*')) {
				if (str_starts_with($upload->type, substr($token, 0, -1))) {
					return true;
				}

				continue;
			}

			if ($upload->type === $token) {
				return true;
			}
		}

		return false;
	}

	/** The `data-fs-min` and `data-fs-max` twins of the native bounds, compared in the order the fs type defines. @return ?array{verdict: Verdict, code: string, params: array} */
	private static function bound(Rule $rule, Field $field, mixed $value): ?array
	{
		if ($field->type === null || !is_string($value)) {
			return null;
		}

		$order = TypeValidator::order($field->type, $value);
		$bound = TypeValidator::order($field->type, trim($rule->param));

		// A value the type cannot parse yields no bounds verdict. Malformedness belongs to the type check.
		if ($order === null || $bound === null) {
			return null;
		}

		if ($rule->kind === 'min-value') {
			return $order < $bound ? self::failure(Verdict::Incomplete, 'min', ['n' => trim($rule->param)]) : null;
		}

		return $order > $bound ? self::failure(Verdict::Invalid, 'max', ['n' => trim($rule->param)]) : null;
	}

	private static function paramOf(Field $field, string $kind): ?string
	{
		foreach ($field->rules as $rule) {
			if ($rule->kind === $kind) {
				return $rule->param;
			}
		}

		return null;
	}

	/** The time-of-day component of a `datetime-local` value. */
	private static function timeOfDay(string $value): ?int
	{
		$halves = explode('T', $value);

		return count($halves) === 2 ? self::seconds($halves[1]) : null;
	}

	/** Seconds from midnight. */
	private static function seconds(string $time): ?int
	{
		if (preg_match(self::TIME, trim($time), $parts) !== 1) {
			return null;
		}

		$hours = (int) $parts[1];
		$minutes = (int) $parts[2];
		$seconds = (int) ($parts[3] ?? 0);

		if ($hours > 23 || $minutes > 59 || $seconds > 59) {
			return null;
		}

		return $hours * 3600 + $minutes * 60 + $seconds;
	}

	private static function bytes(string $size): ?int
	{
		if (preg_match(self::SIZE, $size, $parts) !== 1) {
			return null;
		}

		return (int) round((float) $parts[1] * self::UNITS[strtolower($parts[2])]);
	}

	/** @return array{verdict: Verdict, code: string, params: array} */
	private static function failure(Verdict $verdict, string $code, array $params = []): array
	{
		return ['verdict' => $verdict, 'code' => $code, 'params' => $params];
	}
}
