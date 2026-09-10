<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Payload;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Markup\Parser;
use WebSanity\FormSanity\Payload\Normalizer;
use WebSanity\FormSanity\Payload\Upload;

final class NormalizerTest extends TestCase
{
	private const MARKUP = '<!DOCTYPE html><form data-fs-form action="/x"><input name="city" type="text"><input type="checkbox" name="colors" value="Red"><input type="checkbox" name="colors" value="Blue"><input type="checkbox" name="gift" value="on"><select name="sizes" multiple><option value="S">S</option></select><input name="photo" type="file"><input name="attachment" type="file" multiple></form>';

	public function testAJsonPayloadKeepsItsShapes(): void
	{
		$form = Parser::parse(self::MARKUP);
		$out = Normalizer::normalize(['city' => 'Boston', 'colors' => ['Red', 'Blue'], 'gift' => ['on'], 'sizes' => [], 'token' => 'abc'], [], $form);
		self::assertSame('Boston', $out['city']);
		self::assertSame(['Red', 'Blue'], $out['colors']);
		self::assertSame(['on'], $out['gift']);
		self::assertSame([], $out['sizes']);
		self::assertSame('abc', $out['token']);
		self::assertSame([], $out['photo']);
		self::assertSame([], $out['attachment']);
	}

	public function testAbsentAndEmptyAreTheSame(): void
	{
		$form = Parser::parse(self::MARKUP);
		$out = Normalizer::normalize(['city' => '', 'colors' => []], [], $form);
		self::assertSame('', $out['city']);
		self::assertSame([], $out['colors']);
		self::assertSame([], $out['gift']);
	}

	public function testASuffixedPostIsMappedBack(): void
	{
		$form = Parser::parse(self::MARKUP);
		$out = Normalizer::normalize(['city' => 'Boston', 'colors' => ['Red', 'Blue'], 'gift' => ['on']], [], $form);
		self::assertSame(['Red', 'Blue'], $out['colors']);
		$out = Normalizer::normalize(['colors[]' => ['Red']], [], $form);
		self::assertSame(['Red'], $out['colors']);
	}

	public function testFilesInBothPhpShapes(): void
	{
		$form = Parser::parse(self::MARKUP);
		$files = [
			'photo' => ['name' => 'me.jpg', 'type' => 'image/jpeg', 'size' => 1200, 'tmp_name' => '/tmp/a', 'error' => 0],
			'attachment' => [
				'name' => ['a.pdf', 'b.pdf'],
				'type' => ['application/pdf', 'application/pdf'],
				'size' => [10, 20],
				'tmp_name' => ['/tmp/b', '/tmp/c'],
				'error' => [0, 0],
			],
		];
		$out = Normalizer::normalize([], $files, $form);
		self::assertEquals([new Upload('me.jpg', 'image/jpeg', 1200)], $out['photo']);
		self::assertEquals([new Upload('a.pdf', 'application/pdf', 10), new Upload('b.pdf', 'application/pdf', 20)], $out['attachment']);
	}

	public function testANoFileEntryIsNoFile(): void
	{
		$form = Parser::parse(self::MARKUP);
		$files = ['photo' => ['name' => '', 'type' => '', 'size' => 0, 'tmp_name' => '', 'error' => 4]];
		self::assertSame([], Normalizer::normalize([], $files, $form)['photo']);
	}

	public function testAJsonBodyCannotCarryAFile(): void
	{
		$form = Parser::parse(self::MARKUP);
		$this->expectException(\InvalidArgumentException::class);
		Normalizer::normalize(['photo' => 'me.jpg'], [], $form);
	}
}
