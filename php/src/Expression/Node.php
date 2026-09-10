<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Expression;

/** One node of the tree the parser builds. Its shape is internal to the engine. */
final class Node
{
	public const string NAME = 'name';
	public const string LITERAL = 'literal';
	public const string VALID = 'valid';
	public const string NOT = 'not';
	public const string AND = 'and';
	public const string OR = 'or';
	public const string COMPARE = 'compare';

	/** @param list<self> $children */
	private function __construct(
		public readonly string $kind,
		public readonly string $text,
		public readonly array $children,
	) {
	}

	/** A bare name: the value of the named field. */
	public static function name(string $name): self
	{
		return new self(self::NAME, $name, []);
	}

	/** A string or number literal, already stringified. */
	public static function literal(string $value): self
	{
		return new self(self::LITERAL, $value, []);
	}

	/** The one function: `valid(name)`. */
	public static function validCall(string $name): self
	{
		return new self(self::VALID, $name, []);
	}

	public static function not(self $operand): self
	{
		return new self(self::NOT, '!', [$operand]);
	}

	public static function and(self $left, self $right): self
	{
		return new self(self::AND, '&&', [$left, $right]);
	}

	public static function or(self $left, self $right): self
	{
		return new self(self::OR, '||', [$left, $right]);
	}

	/** A comparison, with the operator in `text`. */
	public static function compare(string $operator, self $left, self $right): self
	{
		return new self(self::COMPARE, $operator, [$left, $right]);
	}
}
