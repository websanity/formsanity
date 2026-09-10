<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Validation;

use WebSanity\FormSanity\Messages;
use WebSanity\FormSanity\Model\Field;
use WebSanity\FormSanity\Model\Form;
use WebSanity\FormSanity\Payload\Normalizer;
use WebSanity\FormSanity\Result;
use WebSanity\FormSanity\Types\Validator as TypeValidator;
use WebSanity\FormSanity\Types\Verdict;
use WebSanity\FormSanity\Unknown;

/** Judges one submission against the markup of its form, and reports every failure as an error object of the submission protocol. */
final class Validator
{
	/** A named button parses as a field, and carries no answer for anything to judge. */
	private const array BUTTONS = ['submit', 'reset', 'button', 'image'];

	/** The server's own code for a key the markup does not define. The registry of the vocabulary is closed, so an extension code carries it. */
	private const string UNKNOWN_CODE = 'x-unknown-field';

	/** The prose that travels with the unknown-key code, which an `x-` code must carry. It names no key, so a probe learns nothing from the answer. */
	private const string UNKNOWN_MESSAGE = 'The submission carries a field this form does not define.';

	/**
	 * @param array<array-key, mixed> $payload
	 * @param array<array-key, mixed> $files
	 * @param ?callable(string, string): bool $unique answers whether the value of the named field is still free
	 * @param list<string> $extras the payload keys a host injects, which are known without being authored
	 */
	public static function validate(Form $form, array $payload, array $files, ?callable $unique, Unknown $unknown, array $extras): Result
	{
		$values = Normalizer::normalize($payload, $files, $form);
		$relevance = new Relevance($form, $values);
		$groups = Rules::groups($form, $relevance);
		$result = new Result([]);

		foreach ($form->fields as $name => $field) {
			$name = (string) $name;

			if (in_array($field->controls[0]->type, self::BUTTONS, true)) {
				continue;
			}

			// The rules of an irrelevant field are inert. Only a non-empty value for one is a failure, because an empty value asserts no answer.
			if (!$relevance->isFieldRelevant($name)) {
				if (self::isAnswered($values[$name] ?? '')) {
					$result = $result->withError($name, 'relevance', Messages::for('relevance'));
				}

				continue;
			}

			$checks = [];

			if (self::namesIrrelevant($field, $values[$name] ?? '', $relevance)) {
				$checks[] = self::failure(Verdict::Invalid, 'relevance');
			}

			$failure = self::merge([...$checks, ...self::checks($form, $field, $relevance, $groups[$name] ?? null)]);

			// Uniqueness is the last word, and it is asked only about a value that survived every other check.
			if ($failure === null) {
				$failure = self::unique($field, $relevance, $unique);
			}

			if ($failure !== null) {
				$result = $result->withError($name, $failure['code'], self::message($failure));
			}
		}

		// However many keys drifted, the reject position is one form-level failure of the submission.
		if ($unknown === Unknown::Reject && self::hasUnknownKey($form, $values, $extras)) {
			$result = $result->withError(null, self::UNKNOWN_CODE, self::UNKNOWN_MESSAGE);
		}

		return $result;
	}

	/**
	 * The verdict of one field, from the native register, the type check, and its rules, or null when every check passes. This is what `valid(name)` reports on in an expression.
	 *
	 * @return ?array{verdict: Verdict, code: string, params: array}
	 */
	public static function field(Form $form, Field $field, Relevance $relevance): ?array
	{
		return self::merge(self::checks($form, $field, $relevance, null));
	}

	/**
	 * Every check that applies to the field, in the order the merge rule fixes: native constraints, the type check, each rule in document order, then group membership.
	 *
	 * @param ?array{verdict: Verdict, code: string, params: array} $group
	 * @return list<array{verdict: Verdict, code: string, params: array}>
	 */
	private static function checks(Form $form, Field $field, Relevance $relevance, ?array $group): array
	{
		$value = $relevance->valueOf($field->name);
		$checks = [];
		$native = self::native($field, $value, $relevance);

		if ($native !== null) {
			$checks[] = $native;
		}

		// The type check is skipped when the native constraints have already returned invalid, and when the value is empty.
		if ($field->type !== null && is_string($value) && $value !== '' && ($native === null || $native['verdict'] !== Verdict::Invalid)) {
			$verdict = TypeValidator::check($field->type, $value, $field->typeParam);

			if ($verdict !== Verdict::Valid) {
				$checks[] = self::failure($verdict, 'type.' . $field->type);
			}
		}

		$uploads = Rules::uploads($field, $value);

		if ($uploads !== null) {
			$checks[] = $uploads;
		}

		foreach ($field->rules as $rule) {
			$failure = Rules::check($rule, $field, $relevance, $form);

			if ($failure !== null) {
				$checks[] = $failure;
			}
		}

		if ($group !== null) {
			$checks[] = $group;
		}

		return $checks;
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function native(Field $field, mixed $value, Relevance $relevance): ?array
	{
		$required = $field->nativeRequired || ($field->required !== null && $field->required->evaluate($relevance));

		// A choice group, a multiple select, and a file field derive their requiredness here: the obligation is met when the relevant value is non-empty.
		if (is_array($value)) {
			return $required && $value === [] ? self::failure(Verdict::Incomplete, 'required') : null;
		}

		if ($required && $value === '') {
			return self::failure(Verdict::Incomplete, 'required');
		}

		$native = Native::check($field->controls[0], is_string($value) ? $value : '');

		return $native['verdict'] === Verdict::Valid ? null : self::failure($native['verdict'], (string) $native['code'], $native['params']);
	}

	/** Whether a submitted value names a member or an option that relevance excludes, or names no member of the choice group at all. */
	private static function namesIrrelevant(Field $field, mixed $value, Relevance $relevance): bool
	{
		foreach (is_array($value) ? $value : [$value] as $item) {
			if (!is_string($item)) {
				continue;
			}

			// A value naming no member of the group asserts an answer the markup never offered, which is the same failure as an answer relevance withdrew.
			if ($relevance->excludes($field->name, $item) || $relevance->namesNoMember($field->name, $item)) {
				return true;
			}
		}

		return false;
	}

	/** @return ?array{verdict: Verdict, code: string, params: array} */
	private static function unique(Field $field, Relevance $relevance, ?callable $unique): ?array
	{
		if ($field->uniqueUrl === null || $unique === null) {
			return null;
		}

		$value = $relevance->get($field->name);

		if ($value === '') {
			return null;
		}

		return $unique($field->name, $value) ? null : self::failure(Verdict::Invalid, 'unique');
	}

	/**
	 * The verdict of a field is the worst verdict among its checks. The reported code belongs to the first check that produced that verdict.
	 *
	 * @param list<array{verdict: Verdict, code: string, params: array}> $checks
	 * @return ?array{verdict: Verdict, code: string, params: array}
	 */
	private static function merge(array $checks): ?array
	{
		$worst = Verdict::worst(...array_column($checks, 'verdict'));

		if ($worst === Verdict::Valid) {
			return null;
		}

		foreach ($checks as $check) {
			if ($check['verdict'] === $worst) {
				return $check;
			}
		}

		return null;
	}

	/**
	 * Whether the submission carries a key that is neither an authored field nor a known extra.
	 *
	 * @param array<string, mixed> $values
	 * @param list<string> $extras
	 */
	private static function hasUnknownKey(Form $form, array $values, array $extras): bool
	{
		foreach (array_keys($values) as $key) {
			$key = (string) $key;

			if (!array_key_exists($key, $form->fields) && !in_array($key, $extras, true)) {
				return true;
			}
		}

		return false;
	}

	/** The prose of an error object: the text an author wrote for the rule, and the catalog line for the code otherwise. @param array{verdict: Verdict, code: string, params: array} $failure */
	private static function message(array $failure): string
	{
		$authored = $failure['params']['message'] ?? null;

		return is_string($authored) ? $authored : Messages::for($failure['code'], $failure['params']);
	}

	private static function isAnswered(mixed $value): bool
	{
		return is_array($value) ? $value !== [] : $value !== '';
	}

	/** @return array{verdict: Verdict, code: string, params: array} */
	private static function failure(Verdict $verdict, string $code, array $params = []): array
	{
		return ['verdict' => $verdict, 'code' => $code, 'params' => $params];
	}
}
