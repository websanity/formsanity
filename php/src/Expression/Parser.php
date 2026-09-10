<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Expression;

use WebSanity\FormSanity\AuthoringError;

/** Reads the expression grammar that serves `data-fs-relevant`, `data-fs-constraint`, and `data-fs-required`. */
final class Parser
{
	/** The punctuation of the grammar, longest first, so `==` is read before `=` falls through to an error. */
	private const array PUNCTUATION = ['||', '&&', '==', '!=', '<=', '>=', '!', '<', '>', '(', ')'];

	/** The comparison operators. A comparison takes exactly one of them and does not chain. */
	private const array COMPARISONS = ['==', '!=', '<=', '>=', '<', '>'];

	/** @param list<array{kind: string, text: string}> $tokens */
	private function __construct(private readonly array $tokens, private int $position = 0)
	{
	}

	public static function parse(string $source): Compiled
	{
		$parser = new self(self::scan($source));
		$root = $parser->expression();
		if ($parser->position < count($parser->tokens)) {
			throw new AuthoringError(sprintf('Trailing input after a complete expression in "%s".', $source));
		}

		return new Compiled($root);
	}

	/**
	 * Cuts the source into tokens. Whitespace between tokens is not significant, and any character the grammar does not define is a syntax error.
	 *
	 * @return list<array{kind: string, text: string}>
	 */
	private static function scan(string $source): array
	{
		$tokens = [];
		$length = strlen($source);
		$at = 0;

		while ($at < $length) {
			$character = $source[$at];

			if (preg_match('/\s/', $character) === 1) {
				$at++;
				continue;
			}

			if ($character === "'") {
				[$value, $at] = self::scanString($source, $at);
				$tokens[] = ['kind' => 'string', 'text' => $value];
				continue;
			}

			if (preg_match('/\G-?[0-9]+(\.[0-9]+)?/', $source, $match, 0, $at) === 1) {
				$tokens[] = ['kind' => 'number', 'text' => $match[0]];
				$at += strlen($match[0]);
				continue;
			}

			if (preg_match('/\G[A-Za-z_][A-Za-z0-9_-]*/', $source, $match, 0, $at) === 1) {
				$tokens[] = ['kind' => 'name', 'text' => $match[0]];
				$at += strlen($match[0]);
				continue;
			}

			$punctuation = self::scanPunctuation($source, $at);
			if ($punctuation === null) {
				throw new AuthoringError(sprintf('Unexpected character "%s" in expression "%s".', $character, $source));
			}

			$tokens[] = ['kind' => 'punctuation', 'text' => $punctuation];
			$at += strlen($punctuation);
		}

		return $tokens;
	}

	/**
	 * Reads a single-quoted string, in which two quotes stand for a literal one.
	 *
	 * @return array{string, int}
	 */
	private static function scanString(string $source, int $at): array
	{
		$length = strlen($source);
		$value = '';
		$at++;

		while ($at < $length) {
			if ($source[$at] !== "'") {
				$value .= $source[$at];
				$at++;
				continue;
			}

			if ($at + 1 < $length && $source[$at + 1] === "'") {
				$value .= "'";
				$at += 2;
				continue;
			}

			return [$value, $at + 1];
		}

		throw new AuthoringError(sprintf('Unterminated string in expression "%s".', $source));
	}

	private static function scanPunctuation(string $source, int $at): ?string
	{
		foreach (self::PUNCTUATION as $candidate) {
			if (substr($source, $at, strlen($candidate)) === $candidate) {
				return $candidate;
			}
		}

		return null;
	}

	/** `or := and ( '||' and )*` */
	private function expression(): Node
	{
		$node = $this->conjunction();
		while ($this->take('||')) {
			$node = Node::or($node, $this->conjunction());
		}

		return $node;
	}

	/** `and := unary ( '&&' unary )*` */
	private function conjunction(): Node
	{
		$node = $this->unary();
		while ($this->take('&&')) {
			$node = Node::and($node, $this->unary());
		}

		return $node;
	}

	/** `unary := '!' unary | primary`. Because `unary` recurses into `primary`, `!` swallows a whole comparison. */
	private function unary(): Node
	{
		if ($this->take('!')) {
			return Node::not($this->unary());
		}

		return $this->primary();
	}

	/** `primary := operand ( ( '==' | '!=' | '<=' | '>=' | '<' | '>' ) operand )?` */
	private function primary(): Node
	{
		$left = $this->operand();
		foreach (self::COMPARISONS as $operator) {
			if ($this->take($operator)) {
				return Node::compare($operator, $left, $this->operand());
			}
		}

		return $left;
	}

	/** `operand := func | name | string | number | '(' expr ')'` */
	private function operand(): Node
	{
		$token = $this->tokens[$this->position] ?? null;
		if ($token === null) {
			throw new AuthoringError('An operand is missing at the end of the expression.');
		}

		$this->position++;

		if ($token['kind'] === 'string') {
			return Node::literal($token['text']);
		}

		if ($token['kind'] === 'number') {
			return Node::literal(self::number($token['text']));
		}

		if ($token['kind'] === 'name') {
			return $this->peek('(') ? $this->call($token['text']) : Node::name($token['text']);
		}

		if ($token['text'] === '(') {
			$inner = $this->expression();
			if (!$this->take(')')) {
				throw new AuthoringError('An opening parenthesis has no closing parenthesis.');
			}

			return $inner;
		}

		throw new AuthoringError(sprintf('Expected an operand, read "%s".', $token['text']));
	}

	/** A name followed by `(` is always a function call, and `valid` is the one function the grammar defines. */
	private function call(string $name): Node
	{
		if ($name !== 'valid') {
			throw new AuthoringError(sprintf('Unknown function "%s". The grammar defines only valid().', $name));
		}

		$this->take('(');
		$argument = $this->tokens[$this->position] ?? null;
		if ($argument === null || $argument['kind'] !== 'name') {
			throw new AuthoringError('valid() takes one field name.');
		}

		$this->position++;
		if (!$this->take(')')) {
			throw new AuthoringError('A call to valid() has no closing parenthesis.');
		}

		return Node::validCall($argument['text']);
	}

	/** A numeric literal normalizes as a number and then stringifies, so `3.0` names the value `3`. */
	private static function number(string $text): string
	{
		return (string) (float) $text;
	}

	private function peek(string $punctuation): bool
	{
		$token = $this->tokens[$this->position] ?? null;

		return $token !== null && $token['kind'] === 'punctuation' && $token['text'] === $punctuation;
	}

	private function take(string $punctuation): bool
	{
		if (!$this->peek($punctuation)) {
			return false;
		}

		$this->position++;

		return true;
	}
}
