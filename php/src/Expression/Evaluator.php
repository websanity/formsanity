<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Expression;

use WebSanity\FormSanity\Types\Validator;

/** Runs a parsed expression against a context. */
final class Evaluator
{
	/** The reading an ordering comparison takes, chosen from the types of its operands. */
	private const string CHRONOLOGICAL = 'chronological';
	private const string TIME_OF_DAY = 'time-of-day';
	private const string TYPE_ORDER = 'type-order';
	private const string NUMERIC = 'numeric';

	/** The truth of a node used where a boolean is expected. A bare operand is truthy when its string value is non-empty. */
	public static function truth(Node $node, Context $context): bool
	{
		return match ($node->kind) {
			Node::NAME => $context->get($node->text) !== '',
			Node::LITERAL => $node->text !== '',
			Node::VALID => $context->get($node->text) !== '' && $context->valid($node->text),
			Node::NOT => !self::truth($node->children[0], $context),
			Node::AND => self::truth($node->children[0], $context) && self::truth($node->children[1], $context),
			Node::OR => self::truth($node->children[0], $context) || self::truth($node->children[1], $context),
			Node::COMPARE => self::compare($node, $context),
			default => false,
		};
	}

	/** The string an operand stringifies to. Anything that reads as a boolean stringifies as `true` or `false`. */
	private static function value(Node $node, Context $context): string
	{
		return match ($node->kind) {
			Node::NAME => $context->get($node->text),
			Node::LITERAL => $node->text,
			default => self::truth($node, $context) ? 'true' : 'false',
		};
	}

	private static function compare(Node $node, Context $context): bool
	{
		[$left, $right] = $node->children;

		if ($node->text === '==' || $node->text === '!=') {
			$same = self::value($left, $context) === self::value($right, $context);

			return $node->text === '==' ? $same : !$same;
		}

		[$reading, $type] = self::reading($left, $right, $context);
		$first = self::order($reading, $type, self::value($left, $context));
		$second = self::order($reading, $type, self::value($right, $context));

		// A comparison is false when either operand is empty or fails to parse as the chosen reading.
		if ($first === null || $second === null) {
			return false;
		}

		return match ($node->text) {
			'<' => $first < $second,
			'<=' => $first <= $second,
			'>' => $first > $second,
			'>=' => $first >= $second,
			default => false,
		};
	}

	/**
	 * Chooses the comparison from the types of the operands. A literal takes the reading of the other side.
	 *
	 * @return array{string, ?string}
	 */
	private static function reading(Node $left, Node $right, Context $context): array
	{
		$types = [];
		foreach ([$left, $right] as $operand) {
			$types[] = $operand->kind === Node::NAME ? $context->typeOf($operand->text) : null;
		}

		if (in_array('date', $types, true) || in_array('datetime-local', $types, true)) {
			return [self::CHRONOLOGICAL, null];
		}

		if (in_array('time', $types, true)) {
			return [self::TIME_OF_DAY, null];
		}

		foreach ($types as $type) {
			if ($type !== null && Validator::isOrdered($type)) {
				return [self::TYPE_ORDER, $type];
			}
		}

		return [self::NUMERIC, null];
	}

	/** Places one operand on the scale the reading defines, or reports null when it is blank or does not parse. */
	private static function order(string $reading, ?string $type, string $value): ?float
	{
		if (trim($value) === '') {
			return null;
		}

		return match ($reading) {
			self::CHRONOLOGICAL => self::chronological($value),
			self::TIME_OF_DAY => self::timeOfDay($value),
			self::TYPE_ORDER => $type === null ? null : Validator::order($type, $value),
			default => self::numeric($value),
		};
	}

	/** A `date` reads as midnight of its day, so it shares one scale with a `datetime-local`. */
	private static function chronological(string $value): ?float
	{
		if (preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]{1,3})?)?)?$/', $value, $match) !== 1) {
			return null;
		}

		$year = (int) $match[1];
		$month = (int) $match[2];
		$day = (int) $match[3];
		$hour = (int) ($match[4] ?? 0);
		$minute = (int) ($match[5] ?? 0);
		$second = (int) ($match[6] ?? 0);

		if (!checkdate($month, $day, $year) || $hour > 23 || $minute > 59 || $second > 59) {
			return null;
		}

		$stamp = gmmktime($hour, $minute, $second, $month, $day, $year);

		return $stamp === false ? null : (float) $stamp;
	}

	/** Seconds from midnight. A literal may omit the leading zero of the hour, so `9:30` and `09:30` name the same instant. */
	private static function timeOfDay(string $value): ?float
	{
		if (preg_match('/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]{1,3})?)?$/', $value, $match) !== 1) {
			return null;
		}

		$hour = (int) $match[1];
		$minute = (int) $match[2];
		$second = (int) ($match[3] ?? 0);

		if ($hour > 23 || $minute > 59 || $second > 59) {
			return null;
		}

		return (float) ($hour * 3600 + $minute * 60 + $second);
	}

	private static function numeric(string $value): ?float
	{
		if (preg_match('/^[+-]?([0-9]+(\.[0-9]+)?|\.[0-9]+)$/', $value) !== 1) {
			return null;
		}

		return (float) $value;
	}
}
